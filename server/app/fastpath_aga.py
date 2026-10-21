"""FastPath + KNN running inside an Aura Graph Analytics session attached to AuraDB."""

from __future__ import annotations

import threading
import warnings
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from typing import Callable

import numpy as np

from .config import MODES, settings
from . import db

warnings.filterwarnings("ignore", message=".*preview feature.*")

GRAPH_NAME = "music"

PROJECTION_QUERY = """
CALL () {
  MATCH (p:Performance)-[:FIRST_EVENT]->(e:NoteEvent)
  RETURN p AS source, e AS target,
         ['Performance'] AS sourceLabels, ['NoteEvent'] AS targetLabels,
         {obsTime: toFloat(p.obsTime)} AS sourceProps,
         {t: toFloat(e.t), noteCode: e.noteCode} AS targetProps,
         'FIRST_EVENT' AS relType
  UNION ALL
  MATCH (a:NoteEvent)-[:NEXT_EVENT]->(b:NoteEvent)
  RETURN a AS source, b AS target,
         ['NoteEvent'] AS sourceLabels, ['NoteEvent'] AS targetLabels,
         {t: toFloat(a.t), noteCode: a.noteCode} AS sourceProps,
         {t: toFloat(b.t), noteCode: b.noteCode} AS targetProps,
         'NEXT_EVENT' AS relType
}
RETURN gds.graph.project.remote(source, target, {
  sourceNodeLabels: sourceLabels,
  targetNodeLabels: targetLabels,
  sourceNodeProperties: sourceProps,
  targetNodeProperties: targetProps,
  relationshipType: relType
})
"""


class AgaBackend:
    name = "aga"

    def __init__(self) -> None:
        self._gds = None
        self._lock = threading.Lock()
        self.status = "idle"

    @property
    def configured(self) -> bool:
        return bool(settings.aura_client_id and settings.aura_client_secret)

    def session(self):
        from graphdatascience.session import AuraAPICredentials, DbmsConnectionInfo, GdsSessions, SessionMemory

        with self._lock:
            if self._gds is not None:
                return self._gds
            if not self.configured:
                raise RuntimeError("AURA_CLIENT_ID / AURA_CLIENT_SECRET não configurados")
            self.status = "starting"
            sessions = GdsSessions(
                api_credentials=AuraAPICredentials(
                    settings.aura_client_id, settings.aura_client_secret, settings.aura_project_id
                )
            )
            if settings.aura_instance_id:
                conn = DbmsConnectionInfo(
                    aura_instance_id=settings.aura_instance_id,
                    username=settings.neo4j_user,
                    password=settings.neo4j_password,
                )
            else:
                conn = DbmsConnectionInfo(
                    uri=settings.neo4j_uri, username=settings.neo4j_user, password=settings.neo4j_password
                )
            memory = getattr(SessionMemory, f"m_{settings.session_memory}", settings.session_memory)
            try:
                self._gds = sessions.get_or_create(
                    session_name=settings.session_name,
                    memory=memory,
                    db_connection=conn,
                    ttl=timedelta(minutes=settings.session_ttl_minutes),
                    arrow_client_options={"call_timeout": settings.arrow_call_timeout},
                )
            except Exception:
                self.status = "error"
                raise
            self.status = "ready"
            return self._gds

    def delete_session(self) -> bool:
        with self._lock:
            if self._gds is None:
                return False
            deleted = self._gds.delete()
            self._gds = None
            self.status = "idle"
            return deleted

    def run(
        self, performances: list[dict], candidates: int, on_step: Callable[[str], None]
    ) -> tuple[dict[str, dict[str, np.ndarray]], dict[str, list[tuple[str, str, float]]]]:
        gds = self.session()
        on_step("project")
        G = gds.graph.project.cypher(GRAPH_NAME, PROJECTION_QUERY, overwrite=True).graph

        node_to_perf = {p["nodeId"]: p["id"] for p in performances}

        def fast_path(mode: str) -> None:
            params = settings.fastpath(mode)
            gds.fast_path.mutate(
                G,
                base_node_label="Performance",
                event_node_label="NoteEvent",
                mutate_property=f"emb_{mode}",
                embedding_dimension=params.embedding_dimension,
                lookback_horizon=params.lookback_horizon,
                num_time_anchors=params.num_time_anchors,
                event_node_categorical_properties=["noteCode"],
                first_relationship_type="FIRST_EVENT",
                next_relationship_type="NEXT_EVENT",
                event_node_time_property="t",
                base_node_observation_time_property="obsTime",
                smoothing_rate=params.smoothing_rate,
                smoothing_window=params.smoothing_window,
                decay_rate=params.decay_rate,
                random_seed=params.random_seed,
            )

        # Each FastPath job has ~20 s of fixed server-side cost, so both modes run concurrently.
        on_step("fastpath_full")
        with ThreadPoolExecutor(len(MODES)) as pool:
            list(pool.map(fast_path, MODES))
        on_step("fastpath_notes")

        embeddings: dict[str, dict[str, np.ndarray]] = {}
        for mode in MODES:
            df = gds.graph.node_properties.stream(G, [f"emb_{mode}"], node_labels=["Performance"])
            value_col = "propertyValue" if "propertyValue" in df.columns else f"emb_{mode}"
            for node_id, value in zip(df["nodeId"], df[value_col]):
                perf_id = node_to_perf.get(int(node_id))
                if perf_id is not None:
                    embeddings.setdefault(perf_id, {})[mode] = np.asarray(value, dtype=float)

        on_step("knn")
        knn: dict[str, list[tuple[str, str, float]]] = {}
        for mode in MODES:
            df = gds.knn.stream(
                G,
                node_properties=f"emb_{mode}",
                node_labels=["Performance"],
                top_k=candidates,
                sample_rate=1.0,
                delta_threshold=0.0,
                random_seed=42,
                concurrency=1,
            )
            knn[mode] = [
                (node_to_perf[int(a)], node_to_perf[int(b)], float(s))
                for a, b, s in zip(df["node1"], df["node2"], df["similarity"])
                if int(a) in node_to_perf and int(b) in node_to_perf
            ]
        gds.graph.drop(G, fail_if_missing=False)
        return embeddings, knn


aga = AgaBackend()


def warmup() -> None:
    aga.session()
    db.ensure_schema()
