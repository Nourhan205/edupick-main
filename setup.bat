@echo off
title EduPick — First-Time Setup
color 0B

echo.
echo  ============================================
echo   EduPick — First-Time Setup
echo  ============================================
echo.

set ROOT=%~dp0
set BACK=%ROOT%back
set FRONT=%ROOT%Front\graduation-project--front
set VENV=%BACK%\venv\Scripts

:: ── Find Python 3.13 ─────────────────────────────────────────
set PYTHON="C:\Users\ALI\AppData\Local\Programs\Python\Python313\python.exe"
if not exist %PYTHON% (
    :: Fallback: try py launcher
    where py >nul 2>&1
    if not errorlevel 1 (
        set PYTHON=py -3.13
    ) else (
        echo [ERROR] Python 3.13 not found.
        echo         Download from https://python.org and re-run setup.
        pause
        exit /b 1
    )
)

echo [1/4] Creating Python virtual environment...
if exist "%BACK%\venv" (
    echo        Already exists — skipping.
) else (
    %PYTHON% -m venv "%BACK%\venv"
    if errorlevel 1 ( echo [ERROR] venv creation failed. & pause & exit /b 1 )
    echo        Done.
)

echo [2/4] Upgrading pip...
"%VENV%\python.exe" -m pip install --upgrade pip --quiet

echo [3/4] Installing Python dependencies...
"%VENV%\pip.exe" install -r "%BACK%\requirements.txt"
if errorlevel 1 ( echo [ERROR] pip install failed. & pause & exit /b 1 )
echo        Done.

echo [4/4] Installing npm packages...
cd /d "%FRONT%"
call npm install
if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )
echo        Done.

:: ── Create .env if missing ───────────────────────────────────
if not exist "%BACK%\.env" (
    echo.
    echo [CONFIG] Creating .env from template...
    copy "%BACK%\.env.example" "%BACK%\.env" >nul
)

echo.
echo  ============================================
echo   Setup complete!
echo  ============================================
echo.
echo  IMPORTANT: Open back\.env and fill in your API keys:
echo    - GROQ_API_KEY
echo    - OPENROUTER_API_KEY
echo    - GEMINI_API_KEY  (optional)
echo    - SERPER_API_KEY  (for comparison tool)
echo    - SMTP_SENDER_EMAIL + SMTP_APP_PASSWORD (for email reset)
echo.
echo  Then run start.bat to launch the project.
echo.
pause
