# ClipperX desktop app (Windows)

`ClipperX.exe` runs the whole app on your PC: the interface in its own window, plus the backend (Whisper transcription, speaker framing, FFmpeg rendering and link downloads). Docker isn't needed. Only clip picking goes out to OpenRouter (or Gemini).

## Where things live

| What | Where |
|---|---|
| Rendered clips | `Videos\ClipperX` (change it in Settings) |
| API keys | Windows Credential Manager, entry "ClipperX" (enter them in Settings) |
| Speech model, saved transcripts, settings | `%LOCALAPPDATA%\ClipperX` |

On first launch the app downloads Whisper's speech model, about 480 MB. The start screen shows a note while that's happening.

## Build

You need Node.js and Python 3.11 (Whisper's engine has no Python 3.14 build yet), plus FFmpeg on your PATH. FFmpeg gets bundled into the app.

```powershell
py -3.11 -m venv desktop\.venv
desktop\.venv\Scripts\pip install -r apps\api\requirements.txt .\vidgrab pywebview pystray pillow keyring pyinstaller
.\desktop\build_windows.ps1
```

The result is `desktop\dist\ClipperX\` (about 820 MB). Zip that folder to share the app.

## Run from source

```powershell
node desktop\build-frontend.mjs
desktop\.venv\Scripts\python desktop\clipperx_desktop.py
```

## How it fits together

- `build-frontend.mjs` builds the Next.js app as static files (`CLIPPERX_DESKTOP=1` in `next.config.ts`) into `desktop\web`.
- `clipperx_desktop.py` does the following:
  - sets up the backend's paths and keys
  - adds a few desktop-only routes (`/api/desktop/*`) for keys, the clips folder and "Show in folder"
  - serves the static site and the API on `127.0.0.1:47800`
  - opens the window
- When the app sets `CLIPPERX_OUTPUT_DIR`, renders sent with `save=true` are written straight into the clips folder.
