@echo off
REM Build script for Demo Agent (sight.sanchez.ph)
REM This builds the agent with demo server configuration

echo Building Sight Agent for Demo...
echo Server: wss://sight.sanchez.ph/ws

cd ..\agent-desktop

npm run tauri build ^
  -- --env SIGHT_SERVER_URL=wss://sight.sanchez.ph/ws ^
  -- --env SIGHT_FALLBACK_URL=https://sight.sanchez.ph/config.json

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful!
    echo Output: agent-desktop\src-tauri\target\release\bundle\msi\
    echo.
    echo Copy to demo server:
    echo   copy agent-desktop\src-tauri\target\release\bundle\msi\*.msi ..\server\releases\agent-demo.msi
) else (
    echo Build failed!
    exit /b 1
)
