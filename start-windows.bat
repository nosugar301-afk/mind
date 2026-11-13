@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8765/index.html
  py -3 -m http.server 8765 --bind 127.0.0.1
) else (
  start "" http://127.0.0.1:8765/index.html
  python -m http.server 8765 --bind 127.0.0.1
)
pause
