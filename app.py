from __future__ import annotations

import asyncio
import hashlib
import re
import shutil
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.audio_engine import MAX_BODY_BYTES, analyze_audio


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "outputs"
STATIC_JS_DIR = STATIC_DIR / "js"
UPLOAD_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
OUTPUT_MAX_AGE_SECONDS = 14 * 24 * 60 * 60
WORKSPACE_CLEANUP_INTERVAL_SECONDS = 6 * 60 * 60
DEMUCS_MODEL = "htdemucs_ft"
ANALYSIS_PROFILE_VERSION = "fullband-neutral-v1"
_last_workspace_cleanup = 0.0

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Spatial Audio NEW", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def prevent_stale_static_cache(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.endswith((".html", ".css", ".js")):
        response.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/js", StaticFiles(directory=STATIC_JS_DIR), name="js")
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")


@app.on_event("startup")
async def startup_cleanup() -> None:
    maybe_prune_workspace_storage(force=True)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/styles.css")
async def styles() -> FileResponse:
    return FileResponse(STATIC_DIR / "styles.css")


@app.get("/app.js")
async def script() -> FileResponse:
    return FileResponse(STATIC_DIR / "app.js")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(
    request: Request,
    filename: str = "audio",
    demucs: bool = True,
    demucs_model: str = DEMUCS_MODEL,
) -> JSONResponse:
    # Keep the query parameter compatible with older pages, but run only the fine-tuned model.
    demucs_model = DEMUCS_MODEL
    # 요청 본문과 분석 프로파일 버전을 함께 해시해 캐시 키를 만든다.
    # 분석 알고리즘이 바뀌면 같은 파일이어도 이전 결과를 재사용하지 않도록 프로파일 문자열을 포함한다.
    maybe_prune_workspace_storage()
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="No audio body was uploaded.")
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Audio file is too large for local analysis.")

    file_hash = hashlib.sha256(ANALYSIS_PROFILE_VERSION.encode("utf-8") + b"\0" + body).hexdigest()
    job_id = file_hash[:12] or uuid.uuid4().hex[:12]
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
            demucs_model=demucs_model,
            cache_key=file_hash,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc

    return JSONResponse(result)


def sanitize_filename(filename: str) -> str:
    name = Path(filename or "audio").name
    name = re.sub(r"[^\w .-]+", "_", name, flags=re.UNICODE).strip(" .")
    return name or "audio"


def maybe_prune_workspace_storage(force: bool = False) -> None:
    global _last_workspace_cleanup
    # 업로드/출력 폴더 정리는 너무 자주 돌면 요청 처리 시간을 늘릴 수 있다.
    # 그래서 일정 시간 간격이 지났거나 startup force일 때만 오래된 작업 폴더를 지운다.
    now = time.time()
    if not force and now - _last_workspace_cleanup < WORKSPACE_CLEANUP_INTERVAL_SECONDS:
        return
    _last_workspace_cleanup = now
    prune_child_dirs(UPLOAD_DIR, UPLOAD_MAX_AGE_SECONDS)
    prune_child_dirs(OUTPUT_DIR, OUTPUT_MAX_AGE_SECONDS, skip_names={"_cache"})


def prune_child_dirs(root: Path, max_age_seconds: int, skip_names: set[str] | None = None) -> None:
    # 삭제 대상은 반드시 root 아래의 하위 디렉터리인지 resolve로 확인한다.
    # 분석 결과 정리 코드가 실수로 프로젝트 밖 경로를 지우지 않게 하는 안전장치다.
    if not root.exists():
        return
    skip_names = skip_names or set()
    try:
        root_resolved = root.resolve()
    except OSError:
        return
    cutoff = time.time() - max_age_seconds
    for child in root.iterdir():
        if child.name in skip_names or not child.is_dir():
            continue
        try:
            resolved = child.resolve()
            resolved.relative_to(root_resolved)
            last_used = child.stat().st_mtime
            for item in child.rglob("*"):
                last_used = max(last_used, item.stat().st_mtime)
        except (OSError, ValueError):
            continue
        if last_used < cutoff:
            shutil.rmtree(resolved, ignore_errors=True)
