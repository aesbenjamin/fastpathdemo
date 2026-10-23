"""Portuguese is the storage language of the graph; these maps render it in English on request."""

from __future__ import annotations

import re

LANGS = ("pt", "en")

NOTE_EN = {"Dó": "C", "Ré": "D", "Mi": "E", "Fá": "F", "Sol": "G", "Lá": "A", "Si": "B", "Dó agudo": "high C"}

TAG_EN = {
    "rápido": "fast",
    "contemplativo": "contemplative",
    "sobe a escada": "climbs the stairs",
    "desce a escada": "goes down the stairs",
    "ping-pong": "ping-pong",
    "silêncio e explosão": "silence and burst",
    "metrônomo": "metronome",
    "agudo": "high",
    "grave": "low",
    "médio": "mid",
}

ARCHETYPE_EN = {
    "Rajada": "Burst",
    "Lento e Grave": "Slow and Low",
    "Escada": "Staircase",
    "Ping-Pong": "Ping-Pong",
    "Silêncio e Explosão": "Silence and Burst",
    "Agudo Saltitante": "Bouncy High",
}

_BOT = re.compile(r"^Eco (.+) (\d+)$")


def norm_lang(lang: str | None) -> str:
    return lang if lang in LANGS else "pt"


def bot_name(name: str, lang: str) -> str:
    if lang != "en":
        return name
    m = _BOT.match(name)
    return f"Echo {ARCHETYPE_EN.get(m.group(1), m.group(1))} {m.group(2)}" if m else name


def display_name(p: dict, lang: str) -> str:
    if lang == "en" and p.get("name_en"):
        return p["name_en"]
    return bot_name(p["name"], lang) if p.get("isBot") else p["name"]


def note(label: str, lang: str) -> str:
    return NOTE_EN.get(label, label) if lang == "en" else label


def facts(f: dict, lang: str) -> dict:
    """Melody or tribe facts with notes, tags and register rendered in `lang`."""
    if lang != "en":
        return f
    out = dict(f)
    if "favoriteNotes" in f:
        out["favoriteNotes"] = [note(n, lang) for n in f["favoriteNotes"]]
    for key in ("tags", "commonTags"):
        if key in f:
            out[key] = [TAG_EN.get(t, t) for t in f[key]]
    if "tagShare" in f:
        out["tagShare"] = {TAG_EN.get(t, t): s for t, s in f["tagShare"].items()}
    if "register" in f:
        out["register"] = TAG_EN.get(f["register"], f["register"])
    return out
