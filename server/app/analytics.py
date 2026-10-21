from __future__ import annotations

import numpy as np
from sklearn.cluster import KMeans
from sklearn.manifold import TSNE
from sklearn.metrics import silhouette_score


def normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.where(norms == 0, 1, norms)


def cosine_candidates(ids: list[str], matrix: np.ndarray, k: int) -> list[tuple[str, str, float]]:
    unit = normalize(matrix)
    sims = unit @ unit.T
    np.fill_diagonal(sims, -np.inf)
    out = []
    for i, source in enumerate(ids):
        for j in np.argsort(-sims[i])[: min(k, len(ids) - 1)]:
            out.append((source, ids[j], float(sims[i, j])))
    return out


def rerank(
    ids: list[str],
    matrix: np.ndarray,
    candidates: list[tuple[str, str, float]],
    top_k: int,
    cosine_weight: float,
    mode: str,
) -> list[dict]:
    """Cosine finds the same pattern; Euclidean adds intensity (how many notes, how dense)."""
    index = {pid: i for i, pid in enumerate(ids)}
    scale = float(np.median(np.linalg.norm(matrix, axis=1))) or 1.0
    scaled = matrix / scale
    by_source: dict[str, list[dict]] = {}
    for source, target, cosine in candidates:
        distance = float(np.linalg.norm(scaled[index[source]] - scaled[index[target]]))
        euclidean = 1.0 / (1.0 + distance)
        score = cosine_weight * cosine + (1 - cosine_weight) * euclidean
        by_source.setdefault(source, []).append(
            {"source": source, "target": target, "mode": mode, "cosine": round(cosine, 4),
             "euclidean": round(euclidean, 4), "score": round(score, 4)}
        )
    out = []
    for rows in by_source.values():
        rows.sort(key=lambda r: r["score"], reverse=True)
        for rank, row in enumerate(rows[:top_k], start=1):
            out.append({**row, "rank": rank})
    return out


def choose_k(unit: np.ndarray, k_min: int = 3, k_max: int = 7) -> int:
    n = len(unit)
    if n < 4:
        return 1
    best_k, best_score = 2, -1.0
    for k in range(min(k_min, n - 1), min(k_max, n - 1) + 1):
        labels = KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(unit)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(unit, labels, metric="cosine")
        if score > best_score:
            best_k, best_score = k, score
    return best_k


def cluster(matrix: np.ndarray, k: int | None = None) -> tuple[np.ndarray, np.ndarray]:
    unit = normalize(matrix)
    k = k or choose_k(unit)
    if k <= 1:
        return np.zeros(len(unit), dtype=int), unit.mean(axis=0, keepdims=True)
    model = KMeans(n_clusters=k, n_init=10, random_state=42).fit(unit)
    return model.labels_, normalize(model.cluster_centers_)


def layout(matrix: np.ndarray) -> np.ndarray:
    unit = normalize(matrix)
    n = len(unit)
    if n < 5:
        coords = np.linspace(-1, 1, n)[:, None] * np.array([[1.0, 0.0]])
        return coords
    perplexity = float(max(2, min(15, (n - 1) / 3)))
    coords = TSNE(n_components=2, metric="cosine", init="pca", perplexity=perplexity, random_state=42).fit_transform(unit)
    return _fill(coords)


def _fill(coords: np.ndarray) -> np.ndarray:
    """Centers and stretches each axis to [-1, 1] so the galaxy uses the whole screen."""
    coords = coords - coords.mean(axis=0)
    span = np.abs(coords).max(axis=0)
    return coords / np.where(span == 0, 1, span)


def align(reference: np.ndarray, moving: np.ndarray) -> np.ndarray:
    """Orthogonal Procrustes so the two galaxy layouts share orientation when toggling modes."""
    u, _, vt = np.linalg.svd(moving.T @ reference)
    return _fill(moving @ (u @ vt))


def originality(ids: list[str], similar: list[dict]) -> dict[str, float]:
    mean_sim: dict[str, list[float]] = {}
    for row in similar:
        mean_sim.setdefault(row["source"], []).append(row["cosine"])
    raw = {pid: 1.0 - float(np.mean(mean_sim.get(pid, [1.0]))) for pid in ids}
    ordered = sorted(raw.values())
    return {pid: round(100.0 * ordered.index(value) / max(len(ordered) - 1, 1)) for pid, value in raw.items()}


def place(new_vec: np.ndarray, ids: list[str], matrix: np.ndarray, coords: np.ndarray, centroids: np.ndarray):
    """Positions a new melody in an existing galaxy without recomputing the layout."""
    unit = normalize(matrix)
    v = new_vec / (np.linalg.norm(new_vec) or 1.0)
    sims = unit @ v
    top = np.argsort(-sims)[:3]
    weights = np.clip(sims[top], 1e-3, None)
    xy = (coords[top] * weights[:, None]).sum(axis=0) / weights.sum()
    tribe = int(np.argmax(centroids @ v))
    neighbors = [(ids[i], float(sims[i])) for i in np.argsort(-sims)[:5]]
    return xy, tribe, neighbors
