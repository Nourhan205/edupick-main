@echo off
title EduPick — Launcher
color 0A

echo.
echo  ██████████████████████████████████████████
echo  █                                        █
echo  █        EduPick — Starting Up           █
echo  █                                        █
echo  ██████████████████████████████████████████
echo.

:: ── Paths ────────────────────────────────────────────────────
set ROOT=%~dp0
set BACK=%ROOT%back
set FRONT=%ROOT%Front\graduation-project--front
set VENV=%BACK%\venv\Scripts

:: ── Check .env ───────────────────────────────────────────────
if not exist "%BACK%\.env" (
    echo [WARN] No .env found — copying from .env.example
    copy "%BACK%\.env.example" "%BACK%\.env" >nul
    echo [WARN] Please fill in your API keys in back\.env before using AI features.
    echo.
)

:: ── Check venv ───────────────────────────────────────────────
if not exist "%VENV%\python.exe" (
    echo [SETUP] Virtual environment not found — creating...
    "C:\Users\ALI\AppData\Local\Programs\Python\Python313\python.exe" -m venv "%BACK%\venv"
    if errorlevel 1 (
        echo [ERROR] Could not create venv. Check that Python 3.13 is installed.
        pause
        exit /b 1
    )
    echo [SETUP] Installing Python dependencies ^(first run — takes a few minutes^)...
    "%VENV%\pip.exe" install -r "%BACK%\requirements.txt" --quiet
    echo [SETUP] Done.
    echo.
)

:: ── Check node_modules ───────────────────────────────────────
if not exist "%FRONT%\node_modules" (
    echo [SETUP] Installing npm packages ^(first run^)...
    cd /d "%FRONT%"
    call npm install --silent
    echo [SETUP] Done.
    echo.
)

:: ── Start Backend (Flask) ────────────────────────────────────
echo [1/2] Starting Flask backend on http://localhost:5000 ...
start "EduPick Backend" cmd /k "cd /d "%BACK%" && "%VENV%\python.exe" app.py"

:: ── Short delay so Flask boots before Vite tries to reach it ─
timeout /t 3 /nobreak >nul

:: ── Start Frontend (Vite) ────────────────────────────────────
echo [2/2] Starting Vite frontend on http://localhost:5173 ...
start "EduPick Frontend" cmd /k "cd /d "%FRONT%" && npm run dev"

echo.
echo  ✓ Both servers are starting in separate windows.
echo  ✓ Frontend: http://localhost:5173
echo  ✓ Backend:  http://localhost:5000
echo.
echo  Press any key to close this launcher window.
pause >nul
