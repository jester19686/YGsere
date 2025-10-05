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
  echo "[PM2] restart bunker-frontend"
  cd "$CLIENT_DIR"
  pm2 restart bunker-frontend --update-env || pm2 start npm --name bunker-frontend -- start
}

restart_back() {
  echo "[PM2] restart bunker-backend"
  cd "$REPO_DIR"
  pm2 restart bunker-backend --update-env || pm2 start index.js --name bunker-backend
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
