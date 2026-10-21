"""Smoke test of the Aura Graph Analytics path: session, remote projection, FastPath and KNN."""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

from app import db  # noqa: E402
from app.fastpath_aga import GRAPH_NAME, PROJECTION_QUERY, aga  # noqa: E402

t0 = time.time()
gds = aga.session()
print(f"sessão pronta em {time.time() - t0:.0f}s")

perfs = db.fetch_performances()
print("performances no banco:", len(perfs), "exemplo nodeId:", perfs[0]["nodeId"])

G = gds.graph.project.cypher(GRAPH_NAME, PROJECTION_QUERY, overwrite=True).graph
print("projeção:", G.node_count(), "nós,", G.relationship_count(), "relações")

ids = gds.graph.node_properties.stream(G, ["obsTime"], node_labels=["Performance"])
print("colunas do stream:", list(ids.columns))
print("ids projetados (amostra):", sorted(ids["nodeId"].tolist())[:5])
print("ids do banco  (amostra):", sorted(p["nodeId"] for p in perfs)[:5])
gds.graph.drop(G, fail_if_missing=False)

embeddings, knn = aga.run(perfs, 10, lambda step: print("  etapa:", step))
some = next(iter(embeddings.values()))
print("embeddings:", len(embeddings), "modos:", list(some), "dim:", len(some["full"]))
print("pares knn:", {m: len(v) for m, v in knn.items()})
