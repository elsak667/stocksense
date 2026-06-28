#!/bin/bash
# Deploy StockSense on QNAP NAS
# Usage: ./deploy.sh [pull|build|up|down|restart]
set -e

COMPOSE="docker compose"
[ -n "$DOCKER_BIN" ] && COMPOSE="$DOCKER_BIN compose"

case "${1:-up}" in
  pull)
    git -C "$(dirname "$0")" pull
    ;;
  build)
    $COMPOSE build --no-cache
    ;;
  up)
    $COMPOSE up -d
    ;;
  down)
    $COMPOSE down
    ;;
  restart)
    $COMPOSE down && $COMPOSE up -d --build
    ;;
  *)
    echo "Usage: $0 {pull|build|up|down|restart}"
    exit 1
    ;;
esac
