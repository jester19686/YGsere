#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/srv/bunker"
CLIENT_DIR="/srv/bunker/client"

usage() {
  echo "Использование: $0 {front|back|all}"
  exit 1
}

git_update() {
  cd "$REPO_DIR"
  echo "[GIT] fetch + hard reset to origin/main"
  git fetch --all --prune
  git reset --hard origin/main
}

build_front() {
  cd "$CLIENT_DIR"
  printf "NEXT_PUBLIC_API_URL=https://bunker-zone.ru\nNEXT_PUBLIC_WS_URL=wss://bunker-zone.ru\n" > .env.production
  echo "[FRONT] npm ci (если есть package-lock) или npm i"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm i
  fi
  echo "[FRONT] next build"
  npm run build
}

restart_front() {
  echo "[PM2] restart bunker-web"
  PORT=3000 pm2 restart bunker-web --time || PORT=3000 pm2 start "npm run start" --name bunker-web --time
}

restart_back() {
  echo "[PM2] restart bunker-ws"
  FRONT_ORIGIN="https://bunker-zone.ru" NODE_ENV="production" PORT="4000" \
  pm2 restart bunker-ws --update-env --time || \
  FRONT_ORIGIN="https://bunker-zone.ru" NODE_ENV="production" PORT="4000" pm2 start index.js --name bunker-ws --time
}

save_pm2() {
  echo "[PM2] save"
  pm2 save
}

case "${1:-}" in
  front)
    git_update
    build_front
    restart_front
    save_pm2
    ;;
  back)
    git_update
    restart_back
    save_pm2
    ;;
  all)
    git_update
    build_front
    restart_front
    restart_back
    save_pm2
    ;;
  *)
    usage
    ;;
esac

echo "Готово."
