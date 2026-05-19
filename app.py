from __future__ import annotations

import asyncio
import re
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.audio_engine import MAX_BODY_BYTES, analyze_audio


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "outputs"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Spatial Audio NEW", version="2.0")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(request: Request, filename: str = "audio", demucs: bool = True) -> JSONResponse:
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="No audio body was uploaded.")
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Audio file is too large for local analysis.")

    job_id = uuid.uuid4().hex[:12]
    safe_name = sanitize_filename(filename)
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    audio_path = job_dir / safe_name
    audio_path.write_bytes(body)

    try:
        result = await asyncio.to_thread(
            analyze_audio,
            audio_path,
            job_id=job_id,
            output_dir=OUTPUT_DIR,
            request_demucs=demucs,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc

    return JSONResponse(result)


def sanitize_filename(filename: str) -> str:
    name = Path(filename or "audio").name
    name = re.sub(r"[^A-Za-z0-9가-힣._ -]+", "_", name).strip(" .")
    return name or "audio"
