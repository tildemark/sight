@echo off
REM ============================================================
REM  Sight Agent - Windows Code Signing Helper
REM ============================================================
REM  Called automatically by Tauri during bundle, once per
REM  binary/MSI/NSIS artifact.  %1 is the file to sign.
REM
REM  Required environment variables (set before running the
REM  build script):
REM    SIGNING_CERT_PATH      Full path to the .pfx certificate
REM    SIGNING_CERT_PASSWORD  Password for the .pfx certificate
REM
REM  If SIGNING_CERT_PATH is not set the script exits cleanly
REM  so that unsigned dev builds still succeed.  Production
REM  releases MUST be signed to pass Windows Smart App Control.
REM ============================================================

if not defined SIGNING_CERT_PATH (
    echo [sign] SIGNING_CERT_PATH not set - skipping code signing.
    echo [sign] WARNING: unsigned builds will be blocked by Windows Smart App Control.
    exit /b 0
)

if not exist "%SIGNING_CERT_PATH%" (
    echo [sign] ERROR: Certificate not found at "%SIGNING_CERT_PATH%"
    exit /b 1
)

echo [sign] Signing: %1

signtool sign ^
    /fd sha256 ^
    /tr http://timestamp.digicert.com ^
    /td sha256 ^
    /f "%SIGNING_CERT_PATH%" ^
    /p "%SIGNING_CERT_PASSWORD%" ^
    %1

if %ERRORLEVEL% NEQ 0 (
    echo [sign] signtool failed with exit code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [sign] Signed successfully.
