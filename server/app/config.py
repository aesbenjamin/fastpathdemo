import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _float(name: str, default: float) -> float:
    return float(_env(name, str(default)))


def _int(name: str, default: int) -> int:
    return int(_env(name, str(default)))


def _bool(name: str, default: bool) -> bool:
    return str(_env(name, str(default))).lower() in ("1", "true", "yes", "on")


# Every performance is capped at this length; the observation time sits right after it,
# so elapsed time = OBSERVATION_TIME - t aligns all melodies by their first note.
MAX_DURATION_MS = 20000
OBSERVATION_TIME = MAX_DURATION_MS + 1


@dataclass(frozen=True)
class FastPathParams:
    embedding_dimension: int
    num_time_anchors: int
    lookback_horizon: int
    smoothing_rate: float
    smoothing_window: int
    decay_rate: float
    random_seed: int


@dataclass(frozen=True)
class Settings:
    neo4j_uri: str = field(default_factory=lambda: _env("NEO4J_URI", "bolt://localhost:7687"))
    neo4j_user: str = field(default_factory=lambda: _env("NEO4J_USER", "neo4j"))
    neo4j_password: str = field(default_factory=lambda: _env("NEO4J_PASSWORD", "password"))
    neo4j_database: str | None = field(default_factory=lambda: _env("NEO4J_DATABASE"))

    backend: str = field(default_factory=lambda: _env("FASTPATH_BACKEND", "aga"))
    fallback_local: bool = field(default_factory=lambda: _bool("FASTPATH_FALLBACK_LOCAL", True))

    aura_client_id: str | None = field(default_factory=lambda: _env("AURA_CLIENT_ID"))
    aura_client_secret: str | None = field(default_factory=lambda: _env("AURA_CLIENT_SECRET"))
    aura_project_id: str | None = field(default_factory=lambda: _env("AURA_PROJECT_ID"))
    aura_instance_id: str | None = field(default_factory=lambda: _env("AURA_INSTANCE_ID"))
    session_name: str = field(default_factory=lambda: _env("GDS_SESSION_NAME", "fastpath-music"))
    session_memory: str = field(default_factory=lambda: _env("GDS_SESSION_MEMORY", "2GB"))
    session_ttl_minutes: int = field(default_factory=lambda: _int("GDS_SESSION_TTL_MIN", 180))
    # VPNs like Cloudflare WARP can take ~45 s to open the first Arrow (gRPC) connection to the session.
    arrow_call_timeout: int = field(default_factory=lambda: _int("GDS_ARROW_TIMEOUT_S", 180))

    openai_api_key: str | None = field(default_factory=lambda: _env("OPENAI_API_KEY"))
    openai_model: str = field(default_factory=lambda: _env("OPENAI_MODEL", "gpt-4.1-mini"))
    openai_base_url: str | None = field(default_factory=lambda: _env("OPENAI_BASE_URL"))

    knn_candidates: int = field(default_factory=lambda: _int("KNN_CANDIDATES", 10))
    knn_top_k: int = field(default_factory=lambda: _int("KNN_TOP_K", 5))
    cosine_weight: float = field(default_factory=lambda: _float("COSINE_WEIGHT", 0.6))
    # Score cut-offs for the verdict shown in the Duel (score = weighted cosine + euclidean, 0..1).
    # By default they are calibrated on the KNN output of the current run (see pipeline.score_thresholds);
    # set the env vars to pin fixed values instead. The numbers below are also the fallback before a run.
    score_very_similar: float | None = field(default_factory=lambda: _float("SCORE_VERY_SIMILAR", 0.80) if _env("SCORE_VERY_SIMILAR") else None)
    score_similar: float | None = field(default_factory=lambda: _float("SCORE_SIMILAR", 0.65) if _env("SCORE_SIMILAR") else None)
    score_weak: float | None = field(default_factory=lambda: _float("SCORE_WEAK", 0.50) if _env("SCORE_WEAK") else None)
    # Band below "similar" that still counts as "slightly similar" when calibrating from the KNN.
    score_weak_band: float = field(default_factory=lambda: _float("SCORE_WEAK_BAND", 0.15))

    def fastpath(self, mode: str) -> FastPathParams:
        anchors = _int("FP_TIME_ANCHORS", 20) if mode == "full" else 1
        horizon = _int("FP_LOOKBACK_HORIZON", OBSERVATION_TIME)
        spacing = horizon / max(anchors - 1, 1)
        return FastPathParams(
            embedding_dimension=_int("FP_DIMENSION", 64),
            num_time_anchors=anchors,
            lookback_horizon=horizon,
            smoothing_rate=_float("FP_SMOOTHING_RATE", round(1.0 / spacing, 6)),
            smoothing_window=_int("FP_SMOOTHING_WINDOW", 1) if mode == "full" else 0,
            decay_rate=_float("FP_DECAY_RATE", 0.0),
            random_seed=_int("FP_RANDOM_SEED", 42),
        )


settings = Settings()


DEFAULT_THRESHOLDS = {"very": 0.80, "similar": 0.65, "weak": 0.50}


def verdict(score: float, thresholds: dict | None = None, reference: dict | None = None) -> dict:
    """Classify a pair score into a human-readable verdict shared by the API and the LLM prompt."""
    th = thresholds or DEFAULT_THRESHOLDS
    if score >= th["very"]:
        level, label = "very", "muito parecidas"
    elif score >= th["similar"]:
        level, label = "similar", "parecidas"
    elif score >= th["weak"]:
        level, label = "weak", "levemente parecidas"
    else:
        level, label = "different", "diferentes"
    return {
        "level": level,
        "label": label,
        "similar": level in ("very", "similar"),
        "thresholds": {k: round(float(th[k]), 2) for k in ("very", "similar", "weak")},
        "reference": reference or {},
    }

MODES = ("full", "notes")
MODE_LABELS = {"full": "notas + tempo", "notes": "só notas"}
