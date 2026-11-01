# Builds desktop\dist\ClipperX\ClipperX.exe (a folder app; zip the folder to share it).
#
# One-time setup, from the repo root (Python 3.11: Whisper's engine has no 3.14 wheels yet):
#   py -3.11 -m venv desktop\.venv
#   desktop\.venv\Scripts\pip install -r apps\api\requirements.txt .\vidgrab pywebview pystray pillow keyring pyinstaller
# Then:
#   .\desktop\build_windows.ps1
param(
    [string]$Ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source,
    [string]$Ffprobe = (Get-Command ffprobe -ErrorAction Stop).Source
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$python = "desktop\.venv\Scripts\python.exe"

# 1. Frontend as static files (desktop\web)
node desktop\build-frontend.mjs
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

# 2. Assets the app ships with
New-Item -ItemType Directory -Force desktop\bin, desktop\models | Out-Null
Copy-Item $Ffmpeg, $Ffprobe desktop\bin -Force
$yunet = "desktop\models\face_detection_yunet_2023mar.onnx"
if (-not (Test-Path $yunet)) {
    & $python -c @"
import hashlib, urllib.request
url = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx'
data = urllib.request.urlopen(url, timeout=60).read()
assert hashlib.sha256(data).hexdigest() == '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4', 'YuNet checksum mismatch'
open(r'$yunet', 'wb').write(data)
"@
}
& $python desktop\make_icon.py

# 3. The app
& $python -m PyInstaller --noconfirm --clean --windowed `
    --name ClipperX `
    --icon "$root\desktop\clipperx.ico" `
    --distpath "$root\desktop\dist" --workpath "$root\desktop\build" --specpath "$root\desktop\build" `
    --paths "$root\apps\api" `
    --add-data "$root\desktop\web;web" `
    --add-data "$root\desktop\models;models" `
    --add-binary "$root\desktop\bin\ffmpeg.exe;bin" `
    --add-binary "$root\desktop\bin\ffprobe.exe;bin" `
    --hidden-import app.main `
    --hidden-import app.reframe `
    --hidden-import app.transcript_pipeline `
    --collect-data faster_whisper `
    --collect-binaries ctranslate2 `
    --collect-binaries onnxruntime `
    --collect-submodules yt_dlp `
    --collect-data yt_dlp_ejs `
    --collect-data vidgrab `
    --hidden-import uvicorn.logging `
    --hidden-import uvicorn.loops.auto `
    --hidden-import uvicorn.protocols.http.auto `
    --hidden-import uvicorn.lifespan.on `
    --hidden-import keyring.backends.Windows `
    "$root\desktop\clipperx_desktop.py"
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
Write-Host "Built desktop\dist\ClipperX\ClipperX.exe"
