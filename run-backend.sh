#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$HERE/job-platform-infra/docker-compose.yml" ]]; then
  ROOT="$HERE"
elif [[ -f "$HERE/../job-platform-infra/docker-compose.yml" ]]; then
  ROOT="$(cd "$HERE/.." && pwd)"
else
  echo "missing job-platform-infra/docker-compose.yml (run from web repo or workspace)" >&2
  exit 1
fi
cd "$ROOT"
WEB_DIR=""
if [[ -f scripts/seed-admin.ps1 ]]; then WEB_DIR="$PWD"; fi
if [[ -f job-platform-web/scripts/seed-admin.ps1 ]]; then WEB_DIR="$PWD/job-platform-web"; fi

echo "========================================"
echo " Job Platform - Run Backend"
echo " postgres + auth :5001  (Docker)"
echo "========================================"

fail() { echo; echo "========================================"; echo " Backend FAILED — $1"; echo "========================================"; exit 1; }

command -v docker >/dev/null 2>&1 || fail "docker not found"
docker info >/dev/null 2>&1 || fail "Docker daemon not running (open Docker Desktop)"
[[ -f job-platform-infra/docker-compose.yml ]] || fail "missing job-platform-infra/docker-compose.yml"
[[ -f job-platform-auth-svc/Dockerfile ]] || fail "missing job-platform-auth-svc/Dockerfile"

echo "[1/4] Sync env..."
if [[ ! -f job-platform-infra/envs/.env.dev ]]; then
  [[ -f job-platform-infra/envs/.env.dev.example ]] || fail "missing .env.dev.example"
  cp job-platform-infra/envs/.env.dev.example job-platform-infra/envs/.env.dev
  echo "  + created envs/.env.dev"
fi
cp job-platform-infra/envs/.env.dev job-platform-infra/.env
cp job-platform-infra/envs/.env.dev job-platform-auth-svc/.env
echo "  + synced infra/.env + auth-svc/.env"
if [[ ! -f job-platform-web/.env ]]; then
  printf 'VITE_API_BASE_URL=/api\n# proxy: vite.config.ts -> http://localhost:5001\n' > job-platform-web/.env
  echo "  + created job-platform-web/.env"
fi

echo
echo "[2/4] Check ports..."
if ss -tln 2>/dev/null | grep -q ':5432 ' || lsof -i :5432 >/dev/null 2>&1; then
  echo "  [WARN] :5432 LISTEN — local Postgres may conflict host port map"
fi

echo
echo "[3/4] docker compose up postgres + auth..."
pushd job-platform-infra >/dev/null

docker compose up -d postgres || fail "postgres start failed"
echo "  + wait postgres healthy..."
PG_OK=0
for _ in $(seq 1 30); do
  st=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' job-platform-postgres 2>/dev/null || true)
  if [[ "$st" == "healthy" ]]; then PG_OK=1; break; fi
  sleep 2
done
[[ "$PG_OK" == "1" ]] || { docker compose logs --tail 40 postgres; fail "postgres not healthy"; }
echo "  + postgres healthy"

AUTH_ST=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' job-platform-auth 2>/dev/null || true)
if [[ "$AUTH_ST" == "healthy" && "${FORCE_BUILD:-0}" != "1" ]]; then
  echo "  + auth already healthy - skip rebuild (FORCE_BUILD=1 to rebuild)"
else
  echo "  + start auth :5001 ..."
  if [[ "${FORCE_BUILD:-0}" == "1" ]]; then
    docker compose up -d --build auth || { docker compose logs --tail 80 auth; fail "auth start failed"; }
  else
    docker compose up -d auth || docker compose up -d --build auth || { docker compose logs --tail 80 auth; fail "auth start failed"; }
  fi
fi

echo "  + wait http://localhost:5001/health ..."
AUTH_OK=0
for _ in $(seq 1 45); do
  if curl -sf http://localhost:5001/health >/dev/null 2>&1; then AUTH_OK=1; break; fi
  sleep 2
done
[[ "$AUTH_OK" == "1" ]] || { docker logs job-platform-auth --tail 60 || true; fail "auth /health timeout"; }
echo "  + auth healthy"

if [[ -f ../job-platform-gateway/Dockerfile ]]; then
  echo "  + starting gateway :5000 ..."
  docker compose up -d --build gateway || echo "  [WARN] gateway failed — web still uses :5001"
else
  echo "  [SKIP] gateway has no Dockerfile yet — web proxy -> :5001"
fi

echo
echo "[4/4] Verify..."
docker compose ps
curl -s http://localhost:5001/health && echo || fail "/health failed"
if [[ -n "$WEB_DIR" && -f "$WEB_DIR/scripts/seed-admin.ps1" ]] && command -v powershell >/dev/null 2>&1; then
  powershell -NoProfile -File "$WEB_DIR/scripts/seed-admin.ps1" || true
else
  for n in "" 2 3 4 5; do
    email="admin${n}@jobplatform.local"
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5001/api/auth/register \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$email\",\"password\":\"Admin12345\",\"fullName\":\"Admin\",\"role\":\"Admin\"}" || true)
    echo "[seed] $email -> $code"
    [[ "$code" == "201" || "$code" == "200" ]] && break
    [[ "$code" == "409" ]] && continue
    break
  done
fi

popd >/dev/null

echo
echo "========================================"
echo " Backend READY"
echo "   Auth  http://localhost:5001/health"
echo "   Web   cd job-platform-web && npm run dev"
echo "         (Vite proxy /api -> http://localhost:5001)"
echo "   Logs  docker logs -f job-platform-auth"
echo "   Stop  cd job-platform-infra && docker compose stop auth postgres"
echo "========================================"
