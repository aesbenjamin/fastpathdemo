"""Offline tuning of the FastPath time grid using the local re-implementation and the echo bots.

Usage: server/.venv/bin/python scripts/tune.py
Scores how well KMeans tribes recover the bot archetypes (Adjusted Rand Index) and how often a
bot's nearest neighbour shares its archetype.
"""

import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
from sklearn.metrics import adjusted_rand_score

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))

from app import analytics, bots, fastpath_local  # noqa: E402
from app.config import OBSERVATION_TIME, settings  # noqa: E402


def evaluate(params, performances, archetypes):
    emb = fastpath_local.embed_all(performances, params)
    ids = [p["id"] for p in performances]
    matrix = np.vstack([emb[i] for i in ids])
    labels, _ = analytics.cluster(matrix, k=len(set(archetypes)))
    ari = adjusted_rand_score(archetypes, labels)
    unit = analytics.normalize(matrix)
    sims = unit @ unit.T
    np.fill_diagonal(sims, -np.inf)
    nn = np.argmax(sims, axis=1)
    hit = float(np.mean([archetypes[i] == archetypes[j] for i, j in enumerate(nn)]))
    return ari, hit


def main():
    raw = bots.make_bots(per_archetype=8, seed=11)
    performances = [{"id": str(i), "notes": b["notes"]} for i, b in enumerate(raw)]
    archetypes = [b["archetype"] for b in raw]
    base = settings.fastpath("full")

    print(f"{'anchors':>7} {'window':>6} {'rate':>9} {'dim':>4}   ARI   NN-hit")
    rows = []
    for anchors in (1, 10, 20, 40, 80):
        for window in (0, 1, 2, 4):
            for dim in (64, 128):
                spacing = OBSERVATION_TIME / max(anchors - 1, 1)
                for rate in (0.5 / spacing, 1.0 / spacing):
                    params = replace(base, num_time_anchors=anchors, smoothing_window=window,
                                     smoothing_rate=rate, embedding_dimension=dim)
                    scores = [evaluate(replace(params, random_seed=s), performances, archetypes) for s in (1, 2, 3)]
                    ari, hit = np.mean(scores, axis=0)
                    rows.append((ari, hit, anchors, window, rate, dim))
                    if anchors == 1:
                        break
                if anchors == 1:
                    break
            if anchors == 1:
                break
    for ari, hit, anchors, window, rate, dim in sorted(rows, reverse=True):
        print(f"{anchors:>7} {window:>6} {rate:>9.5f} {dim:>4}  {ari:5.2f}  {hit:6.2f}")


if __name__ == "__main__":
    main()
