"""Synthetic 'echo bots': behaviours people naturally fall into on an 8-key piano."""

from __future__ import annotations

import numpy as np

from .config import MAX_DURATION_MS

ARCHETYPES = {
    "rajada": "Rajada",
    "lento_grave": "Lento e Grave",
    "escada": "Escada",
    "ping_pong": "Ping-Pong",
    "silencio_explosao": "Silêncio e Explosão",
    "agudo_saltitante": "Agudo Saltitante",
}


def _clip(notes: list[tuple[float, int]]) -> list[dict]:
    out, last = [], -1.0
    for t, c in sorted(notes):
        t = max(0.0, float(t))
        if t <= last or t >= MAX_DURATION_MS - 1:
            continue
        out.append({"t": round(t, 1), "code": int(np.clip(c, 0, 7))})
        last = t
    start = out[0]["t"] if out else 0
    return [{"t": n["t"] - start, "code": n["code"]} for n in out]


def generate(archetype: str, rng: np.random.Generator) -> list[dict]:
    if archetype == "rajada":
        n = rng.integers(28, 48)
        ioi = rng.uniform(110, 170)
        t = np.cumsum(rng.normal(ioi, ioi * 0.2, n).clip(60))
        codes = (rng.integers(2, 6) + np.cumsum(rng.choice([-1, 0, 1], n))).clip(1, 6)
        return _clip(list(zip(t, codes)))
    if archetype == "lento_grave":
        n = rng.integers(6, 10)
        t = np.cumsum(rng.uniform(1200, 2000, n))
        return _clip(list(zip(t, rng.integers(0, 3, n))))
    if archetype == "escada":
        reps = rng.integers(2, 4)
        codes = np.tile(np.arange(8), reps)
        t = np.cumsum(rng.normal(rng.uniform(260, 380), 30, len(codes)).clip(120))
        return _clip(list(zip(t, codes)))
    if archetype == "ping_pong":
        a = rng.integers(0, 5)
        b = a + rng.integers(2, 4)
        n = rng.integers(16, 30)
        t = np.cumsum(rng.normal(rng.uniform(220, 300), 20, n).clip(100))
        return _clip(list(zip(t, [a if i % 2 == 0 else b for i in range(n)])))
    if archetype == "silencio_explosao":
        intro = [(0, rng.integers(0, 3)), (rng.uniform(600, 1200), rng.integers(0, 3))]
        start = rng.uniform(7000, 10000)
        n = rng.integers(18, 30)
        t = start + np.cumsum(rng.normal(120, 25, n).clip(60))
        return _clip(intro + list(zip(t, rng.integers(4, 8, n))))
    if archetype == "agudo_saltitante":
        n = rng.integers(12, 20)
        t = np.cumsum(rng.uniform(350, 700, n))
        return _clip(list(zip(t, rng.integers(5, 8, n))))
    raise ValueError(archetype)


def make_bots(per_archetype: int = 6, seed: int = 7) -> list[dict]:
    rng = np.random.default_rng(seed)
    bots = []
    for key, label in ARCHETYPES.items():
        for i in range(per_archetype):
            bots.append({"name": f"Eco {label} {i + 1}", "archetype": key, "notes": generate(key, rng)})
    return bots
