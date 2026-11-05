@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "HERE=%~dp0"
cd /d "%HERE%"
if exist "job-platform-infra\docker-compose.yml" goto :root_ok
if exist "..\job-platform-infra\docker-compose.yml" (
  cd /d "%HERE%.."
  goto :root_ok
)
echo [ERROR] Run this from job-platform-web or the pbl6 workspace folder.
goto :fail
:root_ok
set "WEB_DIR="
if exist "scripts\seed-admin.ps1" set "WEB_DIR=%CD%"
if exist "job-platform-web\scripts\seed-admin.ps1" set "WEB_DIR=%CD%\job-platform-web"

echo ========================================
echo  Job Platform - Run Backend
echo  postgres + auth :5001  (Docker)
echo ========================================
echo.

if not defined FORCE_BUILD set "FORCE_BUILD=0"

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker not found. Install Docker Desktop first.
  goto :fail
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker Desktop is not running.
  echo   Open Docker Desktop, wait until Engine is running, then retry.
  goto :fail
)

if not exist "job-platform-infra\docker-compose.yml" (
  echo [ERROR] Missing job-platform-infra\docker-compose.yml
  goto :fail
)
if not exist "job-platform-auth-svc\Dockerfile" (
  echo [ERROR] Missing job-platform-auth-svc\Dockerfile
  goto :fail
)

echo [1/4] Sync env...
if not exist "job-platform-infra\envs\.env.dev" (
  if not exist "job-platform-infra\envs\.env.dev.example" (
    echo [ERROR] Missing job-platform-infra\envs\.env.dev.example
    goto :fail
  )
  echo   + create envs\.env.dev from example
  copy /Y "job-platform-infra\envs\.env.dev.example" "job-platform-infra\envs\.env.dev" >nul
)

copy /Y "job-platform-infra\envs\.env.dev" "job-platform-infra\.env" >nul
copy /Y "job-platform-infra\envs\.env.dev" "job-platform-auth-svc\.env" >nul
echo   + synced infra\.env + auth-svc\.env

if not exist "job-platform-web\.env" (
  >"job-platform-web\.env" echo VITE_API_BASE_URL=/api
  >>"job-platform-web\.env" echo # vite proxy -^> http://localhost:5001
  echo   + created job-platform-web\.env
)

echo.
echo [2/4] Check ports...
netstat -ano | findstr ":5432" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo   [WARN] :5432 is LISTENING - local Postgres may conflict host port.
  echo          Docker auth still uses Host=postgres:5432 internally.
)
netstat -ano | findstr ":5001" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo   [INFO] :5001 is LISTENING - will reuse auth if healthy.
)

echo.
echo [3/4] docker compose up postgres + auth...
pushd "job-platform-infra"
if errorlevel 1 goto :fail

docker compose up -d postgres
if errorlevel 1 (
  echo [ERROR] Failed to start postgres.
  echo   Try: docker compose down
  echo        docker compose logs postgres
  popd
  goto :fail
)

echo   + waiting postgres healthy...
set "PG_OK=0"
for /L %%i in (1,1,30) do (
  for /f "usebackq delims=" %%s in (`docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" job-platform-postgres 2^>nul`) do (
    if /I "%%s"=="healthy" set "PG_OK=1"
  )
  if "!PG_OK!"=="1" goto :pg_ready
  call :sleep
)
:pg_ready
if not "!PG_OK!"=="1" (
  echo [ERROR] Postgres not healthy after ~60s.
  docker compose ps
  docker compose logs --tail 40 postgres
  popd
  goto :fail
)
echo   + postgres healthy

set "AUTH_ALREADY=0"
for /f "usebackq delims=" %%s in (`docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" job-platform-auth 2^>nul`) do (
  if /I "%%s"=="healthy" set "AUTH_ALREADY=1"
)
if "!AUTH_ALREADY!"=="1" if not "!FORCE_BUILD!"=="1" (
  echo   + auth already healthy - skip rebuild
  goto :wait_auth
)

echo   + starting auth :5001 ...
if "!FORCE_BUILD!"=="1" (
  docker compose up -d --build auth
) else (
  docker compose up -d auth
)
if errorlevel 1 (
  echo   [WARN] up auth failed - retry with --build ...
  docker compose up -d --build auth
)
if errorlevel 1 (
  echo [ERROR] Failed to start auth.
  echo   See: docker compose logs --tail 80 auth
  popd
  goto :fail
)

:wait_auth
echo   + waiting http://localhost:5001/health ...
set "AUTH_OK=0"
for /L %%i in (1,1,45) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri http://localhost:5001/health -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch { }; exit 1" >nul 2>&1
  if not errorlevel 1 (
    set "AUTH_OK=1"
    goto :auth_ready
  )
  call :sleep
)
:auth_ready
if not "!AUTH_OK!"=="1" (
  echo [ERROR] Auth /health timeout after ~90s.
  docker compose ps
  docker logs job-platform-auth --tail 60
  popd
  goto :fail
)
echo   + auth healthy

if exist "..\job-platform-gateway\Dockerfile" (
  echo   + starting gateway :5000 ...
  docker compose up -d gateway
  if errorlevel 1 echo   [WARN] gateway failed - web still uses :5001
) else (
  echo   [SKIP] gateway has no Dockerfile yet - web proxy to :5001
)

echo.
echo [4/4] Verify...
docker compose ps
echo.
powershell -NoProfile -Command "try { $h=(Invoke-WebRequest -Uri http://localhost:5001/health -UseBasicParsing).Content; Write-Host ('[OK] GET /health  ' + $h) } catch { Write-Host ('[FAIL] /health  ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 (
  popd
  goto :fail
)

if defined WEB_DIR if exist "%WEB_DIR%\scripts\seed-admin.ps1" (
  echo   + seed Admin account...
  powershell -NoProfile -File "%WEB_DIR%\scripts\seed-admin.ps1"
) else (
  powershell -NoProfile -Command "$e='dev'+(Get-Random -Maximum 99999)+'@example.com'; $b=@{email=$e;password='Abc12345';fullName='Dev User';role='User'}|ConvertTo-Json; try { $r=Invoke-WebRequest -Uri http://localhost:5001/api/auth/register -Method POST -ContentType 'application/json' -Body $b -UseBasicParsing; Write-Host ('[OK] POST /api/auth/register ' + $r.StatusCode) } catch { if ($_.Exception.Response.StatusCode.value__ -eq 409) { Write-Host '[OK] register endpoint alive (409)' } else { Write-Host ('[WARN] register: ' + $_.Exception.Message) } }"
)

popd

echo.
echo ========================================
echo  Backend READY
echo    Auth     http://localhost:5001/health
echo    Admin    scripts\seed-admin.ps1  (admin@jobplatform.local / Admin12345)
echo    Web      cd job-platform-web ^&^& npm run dev
echo             Vite proxy /api -^> http://localhost:5001
echo    Logs     docker logs -f job-platform-auth
echo    Stop     cd job-platform-infra ^&^& docker compose stop auth postgres
echo    Rebuild  set FORCE_BUILD=1 ^&^& run-backend.bat
echo ========================================
echo  Note: gateway http://localhost:5000 starts when its Dockerfile exists.
echo        Vite still proxies /api to http://localhost:5001.
echo  If Docker Desktop is closed this script stops at the Docker check.
echo ========================================
if /I "%~1"=="--no-pause" exit /b 0
pause
exit /b 0

:fail
echo.
echo ========================================
echo  Backend FAILED - see [ERROR] above.
echo ========================================
if /I "%~1"=="--no-pause" exit /b 1
pause
exit /b 1

:sleep
REM ~2s sleep without timeout.exe (works with redirected stdin)
ping -n 3 127.0.0.1 >nul
goto :eof
