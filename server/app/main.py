from __future__ import annotations

import logging
import threading
from dataclasses import asdict

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import ask as ask_module
from . import bots, db, llm, pipeline
from .config import settings
from .fastpath_aga import aga

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="FastPath Music")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def private_network_access(request: Request, call_next):
    # Lets the GitHub Pages stage (https) call this server on localhost.
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.on_event("startup")
def startup() -> None:
    try:
        db.ensure_schema()
    except Exception as exc:
        logging.warning("Neo4j indisponível no startup: %s", exc)


@app.get("/api/health")
def health() -> dict:
    try:
        db.run("RETURN 1")
        neo4j_ok = True
    except Exception:
        neo4j_ok = False
    return {
        "neo4j": neo4j_ok,
        "backend": settings.backend,
        "agaConfigured": aga.configured,
        "session": aga.status,
        "llm": llm.enabled(),
        "model": settings.openai_model if llm.enabled() else None,
        "fastpath": asdict(settings.fastpath("full")),
    }


@app.post("/api/session/warmup")
def warmup() -> dict:
    if settings.backend != "aga":
        return {"session": "not-used"}
    if aga.status not in ("starting", "ready"):
        threading.Thread(target=aga.session, daemon=True).start()
        aga.status = "starting"
    return {"session": aga.status}


@app.delete("/api/session")
def delete_session() -> dict:
    return {"deleted": aga.delete_session()}


@app.get("/api/lobby")
def lobby() -> dict:
    return db.lobby()


@app.post("/api/run")
def run() -> dict:
    return pipeline.start_job()


@app.get("/api/job")
def job() -> dict:
    return pipeline.job


@app.get("/api/state")
def state() -> dict:
    return pipeline.state()


class ExplainBody(BaseModel):
    a: str
    b: str
    mode: str = "full"
    lang: str = "pt"


@app.post("/api/explain")
def explain(body: ExplainBody) -> dict:
    try:
        return pipeline.explain(body.a, body.b, body.mode, body.lang)
    except KeyError:
        raise HTTPException(404, "i18n:performance_not_found")


class ComposeBody(BaseModel):
    tribeId: str


@app.post("/api/compose")
def compose(body: ComposeBody) -> dict:
    try:
        return pipeline.compose(body.tribeId)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))


class AskBody(BaseModel):
    question: str
    lang: str = "pt"


@app.post("/api/ask")
def ask(body: AskBody) -> dict:
    return ask_module.ask(body.question, body.lang)


@app.get("/api/ask/suggestions")
def suggestions(lang: str = "pt") -> list[str]:
    return ask_module.suggestions(lang)


class SeedBody(BaseModel):
    perArchetype: int = 6


@app.post("/api/seed")
def seed(body: SeedBody) -> dict:
    db.ensure_schema()
    db.delete_performances("p.isBot")
    created = [db.create_performance(b["name"], b["notes"], is_bot=True, archetype=b["archetype"])
               for b in bots.make_bots(body.perArchetype)]
    return {"bots": len(created)}


class ResetBody(BaseModel):
    keepBots: bool = True


@app.post("/api/reset")
def reset(body: ResetBody) -> dict:
    where = "NOT p.isBot" if body.keepBots else "true"
    removed = db.delete_performances(where)
    db.clear_results()
    db.run(
        "MATCH (p:Performance) REMOVE p.profileTitle, p.profileText, p.profileTitle_en, p.profileText_en, "
        "p.tribe_full, p.tribe_notes, p.x_full, p.y_full, p.x_notes, p.y_notes, p.originality"
    )
    pipeline.job.update(status="idle", step=None, done=[])
    pipeline._cache.clear()
    return {"removed": removed}
