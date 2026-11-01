"""
ClipperX desktop app: runs the FastAPI backend and the static frontend in one process and
shows them in a native window.

Where things live:
- %LOCALAPPDATA%\\ClipperX: the Whisper model, saved transcripts, settings
- Windows Credential Manager ("ClipperX"): the OpenRouter/Gemini API keys
- Videos\\ClipperX (changeable in Settings): rendered clips
"""

import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

PORT = int(os.environ.get("CLIPPERX_PORT", "47800"))
BASE_URL = f"http://127.0.0.1:{PORT}"
KEYRING_SERVICE = "ClipperX"
KEY_NAMES = {"openrouter": "OPENROUTER_API_KEY", "gemini": "GEMINI_API_KEY"}

FROZEN = getattr(sys, "frozen", False)
BUNDLE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
REPO = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "ClipperX"
SETTINGS_FILE = DATA_DIR / "settings.json"


# Site files (web/), the face model (models/) and FFmpeg (bin/): the bundle root in the .exe,
# the desktop/ folder when running from source
ASSETS = BUNDLE if FROZEN else REPO / "desktop"


def _bundled(*parts: str) -> Path:
    return ASSETS.joinpath(*parts)


def _load_settings() -> dict:
    try:
        return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save_settings(values: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(values, indent=2), encoding="utf-8")


def _prepare_environment() -> None:
    """Everything the backend reads from the environment, set before it is imported."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings = _load_settings()
    output_dir = settings.get("output_dir") or str(Path.home() / "Videos" / "ClipperX")
    os.environ.update({
        "CLIPPERX_DESKTOP": "1",
        "CLIPPERX_OUTPUT_DIR": output_dir,
        "HF_HOME": str(DATA_DIR / "models"),
        "TRANSCRIPT_CACHE_DIR": str(DATA_DIR / "transcripts"),
        "YUNET_MODEL": str(_bundled("models", "face_detection_yunet_2023mar.onnx")),
    })
    ffmpeg_dir = _bundled("bin")
    if (ffmpeg_dir / "ffmpeg.exe").exists():
        # The backend and yt-dlp call "ffmpeg"/"ffprobe" by name; put the bundled copies first
        os.environ["PATH"] = f"{ffmpeg_dir}{os.pathsep}{os.environ.get('PATH', '')}"
        os.environ["VIDGRAB_FFMPEG"] = str(ffmpeg_dir / "ffmpeg.exe")
    if not FROZEN:
        sys.path.insert(0, str(REPO / "apps" / "api"))

    import keyring

    for env_name in KEY_NAMES.values():
        try:
            value = keyring.get_password(KEYRING_SERVICE, env_name)
        except Exception:  # noqa: BLE001 - no credential store: keys can still be typed in
            value = None
        if value:
            os.environ[env_name] = value


def _build_app():
    from fastapi import Body, HTTPException
    from fastapi.staticfiles import StaticFiles

    from app import main as backend
    from app import transcript_pipeline

    state = {"whisper_ready": False, "whisper_error": ""}

    def warm_whisper():
        # First run downloads the speech model (~480 MB); do it now instead of mid-analysis
        try:
            transcript_pipeline._get_whisper()
            state["whisper_ready"] = True
        except Exception as exc:  # noqa: BLE001 - shown in the UI; analysis retries the load
            state["whisper_error"] = str(exc)

    threading.Thread(target=warm_whisper, name="whisper-warmup", daemon=True).start()
    app = backend.app

    @app.get("/api/desktop/info")
    def desktop_info():
        return {
            "output_dir": os.environ["CLIPPERX_OUTPUT_DIR"],
            "keys": {name: bool(os.environ.get(env)) for name, env in KEY_NAMES.items()},
            "whisper_ready": state["whisper_ready"],
            "whisper_error": state["whisper_error"],
        }

    @app.post("/api/desktop/keys")
    def save_keys(payload: dict = Body(...)):
        import keyring

        for name, env_name in KEY_NAMES.items():
            value = str(payload.get(name) or "").strip()
            if not value:
                continue
            try:
                keyring.set_password(KEYRING_SERVICE, env_name, value)
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=500, detail=f"Couldn't store the key: {exc}")
            os.environ[env_name] = value
        return desktop_info()

    @app.post("/api/desktop/output-dir")
    def set_output_dir(payload: dict = Body(...)):
        path = Path(str(payload.get("path") or "")).expanduser()
        if not path.is_absolute():
            raise HTTPException(status_code=400, detail="Choose a full folder path, like C:\\Users\\you\\Videos\\Clips.")
        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Can't use that folder: {exc}")
        os.environ["CLIPPERX_OUTPUT_DIR"] = str(path)
        _save_settings({**_load_settings(), "output_dir": str(path)})
        return desktop_info()

    @app.post("/api/desktop/show")
    def show_in_folder(payload: dict = Body(default={})):
        output_dir = Path(os.environ["CLIPPERX_OUTPUT_DIR"])
        target = Path(str(payload.get("path") or output_dir))
        # Only reveal things inside the clips folder
        if target != output_dir and output_dir not in target.parents:
            raise HTTPException(status_code=400, detail="That file isn't in the clips folder.")
        output_dir.mkdir(parents=True, exist_ok=True)
        if target.is_file():
            subprocess.Popen(["explorer", "/select,", str(target)])
        else:
            os.startfile(str(target))  # noqa: S606 - opens the user's own clips folder
        return {"ok": True}

    # The static frontend answers everything that isn't an API route
    app.mount("/", StaticFiles(directory=str(_bundled("web")), html=True), name="web")
    return app


def _already_running() -> bool:
    import httpx

    try:
        return httpx.get(f"{BASE_URL}/api/health", timeout=1).status_code == 200
    except httpx.HTTPError:
        return False


def main() -> int:
    import webview

    if not _already_running():
        _prepare_environment()
        import uvicorn

        server = uvicorn.Server(uvicorn.Config(_build_app(), host="127.0.0.1", port=PORT, log_level="warning"))
        threading.Thread(target=server.run, name="clipperx-server", daemon=True).start()
        deadline = time.time() + 30
        while not server.started and time.time() < deadline:
            time.sleep(0.1)
        if not server.started:
            print(f"ClipperX could not start on port {PORT}.", file=sys.stderr)
            return 1
    # A second launch just opens another window onto the running app

    webview.create_window("ClipperX", BASE_URL, width=1280, height=840, min_size=(480, 560))
    webview.start()
    return 0


if __name__ == "__main__":
    # A windowed .exe has no console: give libraries that print somewhere harmless to write
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")
    sys.exit(main())
