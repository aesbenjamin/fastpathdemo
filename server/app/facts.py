"""Human-readable descriptors of a melody. They are the only musical "truth" the LLM gets to see."""

from __future__ import annotations

from collections import Counter

import numpy as np

from .notes import CODE_TO_LABEL


def melody_facts(notes: list[dict]) -> dict:
    times = np.array([n["t"] for n in notes], dtype=float)
    codes = np.array([n["code"] for n in notes], dtype=int)
    n = len(notes)
    duration_s = float(times[-1] / 1000.0) if n > 1 else 0.0
    iois = np.diff(times) / 1000.0 if n > 1 else np.array([0.0])
    intervals = np.diff(codes) if n > 1 else np.array([0])

    counts = Counter(codes.tolist())
    top = [CODE_TO_LABEL[c] for c, _ in counts.most_common(3)]
    mean_pitch = float(codes.mean())
    register = "grave" if mean_pitch < 2.5 else "agudo" if mean_pitch > 4.5 else "médio"

    up = float((intervals > 0).mean()) if n > 1 else 0.0
    down = float((intervals < 0).mean()) if n > 1 else 0.0
    repeat = float((intervals == 0).mean()) if n > 1 else 0.0
    mean_ioi = float(iois.mean())
    regularity = float(1.0 - min(iois.std() / mean_ioi, 1.0)) if mean_ioi > 0 else 0.0
    longest_pause = float(iois.max()) if n > 1 else 0.0

    half = duration_s / 2 if duration_s > 0 else 0
    first_half = int((times / 1000.0 <= half).sum()) if half else n
    second_half = n - first_half

    nps = n / duration_s if duration_s > 0 else float(n)
    tags: list[str] = []
    if nps >= 4:
        tags.append("rápido")
    elif nps <= 1.2:
        tags.append("contemplativo")
    if up >= 0.6:
        tags.append("sobe a escada")
    if down >= 0.6:
        tags.append("desce a escada")
    if len(counts) <= 2 and n >= 6:
        tags.append("ping-pong")
    if longest_pause >= 3 and second_half > first_half:
        tags.append("silêncio e explosão")
    if regularity >= 0.75 and n >= 6:
        tags.append("metrônomo")
    if register != "médio":
        tags.append(register)

    return {
        "noteCount": n,
        "durationSeconds": round(duration_s, 1),
        "notesPerSecond": round(nps, 2),
        "uniqueNotes": len(counts),
        "favoriteNotes": top,
        "register": register,
        "ascendingRatio": round(up, 2),
        "descendingRatio": round(down, 2),
        "repeatRatio": round(repeat, 2),
        "meanIntervalSeconds": round(mean_ioi, 2),
        "rhythmRegularity": round(regularity, 2),
        "longestPauseSeconds": round(longest_pause, 1),
        "notesFirstHalf": first_half,
        "notesSecondHalf": second_half,
        "tags": tags,
    }


def tribe_facts(member_facts: list[dict]) -> dict:
    def avg(key: str) -> float:
        return round(float(np.mean([f[key] for f in member_facts])), 2)

    tags = Counter(t for f in member_facts for t in f["tags"])
    notes = Counter(n for f in member_facts for n in f["favoriteNotes"])
    return {
        "size": len(member_facts),
        "avgNotesPerSecond": avg("notesPerSecond"),
        "avgNoteCount": avg("noteCount"),
        "avgDurationSeconds": avg("durationSeconds"),
        "avgAscendingRatio": avg("ascendingRatio"),
        "avgRhythmRegularity": avg("rhythmRegularity"),
        "avgLongestPauseSeconds": avg("longestPauseSeconds"),
        "commonTags": [t for t, _ in tags.most_common(4)],
        "tagShare": {t: round(c / len(member_facts), 2) for t, c in tags.items()},
        "favoriteNotes": [n for n, _ in notes.most_common(3)],
    }
