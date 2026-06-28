#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8080}"
PAGE="${1:-books/jinpingmei/index.html}"
PID_FILE="$ROOT/.reader-server.pid"

usage() {
  cat <<EOF
用法: ./start-reader.sh [reader.html]

启动本机阅读伺服器并在浏览器打开页面。

范例:
  ./start-reader.sh                          # 金瓶梅 前言
  ./start-reader.sh books/jinpingmei/jinpingmei-001-reader.html
  ./start-reader.sh books/shijinduan/index.html
  ./start-reader.sh shijinduan-000-reader.html

环境变量:
  PORT=8080   指定埠号

Cursor 内嵌浏览器请手动打开:
  http://127.0.0.1:${PORT}/\${PAGE}
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "$ROOT/$PAGE" ]]; then
  echo "找不到: $ROOT/$PAGE" >&2
  exit 1
fi

server_running() {
  lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

start_server() {
  cd "$ROOT"
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  echo $! >"$PID_FILE"

  for _ in $(seq 1 25); do
    if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done

  echo "伺服器启动失败（port $PORT）" >&2
  exit 1
}

if server_running; then
  echo "伺服器已在运行: http://127.0.0.1:$PORT"
else
  start_server
  echo "已启动伺服器: http://127.0.0.1:$PORT"
  echo "关闭方式: kill \$(cat $PID_FILE)"
fi

URL="http://127.0.0.1:$PORT/$PAGE"
echo "打开: $URL"
open "$URL"
