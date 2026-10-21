"""Creates constraints, the 8 Note nodes and the echo bots (behaviour archetypes).

Usage: server/.venv/bin/python scripts/seed.py [--per-archetype 6] [--reset]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))

from app import bots, db  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-archetype", type=int, default=6)
    parser.add_argument("--reset", action="store_true", help="apaga TODAS as performances antes (inclusive humanas)")
    args = parser.parse_args()

    db.ensure_schema()
    removed = db.delete_performances("true" if args.reset else "p.isBot")
    db.clear_results()
    created = 0
    for bot in bots.make_bots(args.per_archetype):
        db.create_performance(bot["name"], bot["notes"], is_bot=True, archetype=bot["archetype"])
        created += 1
    print(f"Removidas: {removed}. Bots criados: {created} ({len(bots.ARCHETYPES)} arquétipos).")


if __name__ == "__main__":
    main()
