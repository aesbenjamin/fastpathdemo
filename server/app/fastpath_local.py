"""NumPy re-implementation of FastPath following the algorithm description in the GDS docs.

Used only as a fallback (no Aura Graph Analytics session) and for offline parameter tuning.
It is not bit-identical to the GDS implementation, but follows the same steps:
time grid -> random vectors per (category, grid time) -> time-smoothed event embeddings
-> decayed sum per base node.
"""

from __future__ import annotations

import numpy as np

from .config import OBSERVATION_TIME, FastPathParams
from .notes import NUM_NOTES


def _random_grid(params: FastPathParams) -> np.ndarray:
    rng = np.random.default_rng(params.random_seed)
    shape = (NUM_NOTES, params.num_time_anchors, params.embedding_dimension)
    sparse = rng.choice([-1.0, 0.0, 1.0], p=[1 / 6, 2 / 3, 1 / 6], size=shape)
    return sparse * np.sqrt(3.0)


def embed(notes: list[dict], params: FastPathParams, grid_vectors: np.ndarray | None = None) -> np.ndarray:
    vectors = grid_vectors if grid_vectors is not None else _random_grid(params)
    anchors = params.num_time_anchors
    grid = np.linspace(0, params.lookback_horizon, anchors) if anchors > 1 else np.array([0.0])
    out = np.zeros(params.embedding_dimension)
    for note in notes:
        elapsed = OBSERVATION_TIME - float(note["t"])
        if elapsed <= 0 or elapsed > params.lookback_horizon:
            continue
        closest = int(np.argmin(np.abs(grid - elapsed))) if anchors > 1 else 0
        lo, hi = max(0, closest - params.smoothing_window), min(anchors, closest + params.smoothing_window + 1)
        window = np.arange(lo, hi)
        weights = np.exp(-np.abs(grid[window] - elapsed) * params.smoothing_rate) if anchors > 1 else np.ones(1)
        weights = weights / weights.sum()
        event_embedding = (weights[:, None] * vectors[int(note["code"]), window]).sum(axis=0)
        out += np.exp(-params.decay_rate * elapsed) * event_embedding
    return out


def embed_all(performances: list[dict], params: FastPathParams) -> dict[str, np.ndarray]:
    vectors = _random_grid(params)
    return {p["id"]: embed(p["notes"], params, vectors) for p in performances}
