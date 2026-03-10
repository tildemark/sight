@echo off
REM Build script for Demo Agent (sight.sanchez.ph)
REM This builds the agent with demo server configuration

echo Building Sight Agent for Demo...
echo Server: wss://sight.sanchez.ph/ws

cd ..\agent-desktop

REM Set environment variables for the build
set SIGHT_SERVER_URL=wss://sight.sanchez.ph/ws
set SIGHT_FALLBACK_URL=https://sight.sanchez.ph/config.json

npm run tauri build -- --config src-tauri/tauri.demo.conf.json

if %ERRORLEVEL% EQU 0 (
    if exist src-tauri\target\release\bundle\msi\sight-agent-demo_1.1.0_x64_en-US.msi (
        copy /Y src-tauri\target\release\bundle\msi\sight-agent-demo_1.1.0_x64_en-US.msi ..\server\releases\agent-demo.msi >nul
    )
    echo.
    echo Build successful!
    echo Output: src-tauri\target\release\bundle\msi\sight-agent-demo_1.1.0_x64_en-US.msi
    echo Release copy: ..\server\releases\agent-demo.msi
    echo.
    echo Variant identity: sight-agent-demo / com.asanchez.sight-agent.demo
) else (
    echo Build failed!
    exit /b 1
)
