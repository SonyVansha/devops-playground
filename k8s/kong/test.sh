#!/usr/bin/env bash
# Tes API gateway Kong. Pakai: PROXY=http://<kong-proxy-ip> API_KEY=<key> ./test.sh
set -u
PROXY="${PROXY:-http://localhost:8000}"
HOST="${HOST_HEADER:-gateway.local}"
API_KEY="${API_KEY:-}"

code() { curl -s -o /dev/null -w '%{http_code}' -H "Host: ${HOST}" "$@"; }
check() { # nama, expected, actual
  if [ "$2" = "$3" ]; then echo "PASS  $1 ($3)"; else echo "FAIL  $1 expected=$2 got=$3"; fi
}

check "blue publik"                200 "$(code "${PROXY}/blue")"
check "green tanpa key ditolak"    401 "$(code "${PROXY}/green")"
check "green key salah ditolak"    401 "$(code -H 'apikey: salah' "${PROXY}/green")"
[ -n "$API_KEY" ] && check "green dengan key" 200 "$(code -H "apikey: ${API_KEY}" "${PROXY}/green")"
check "strip-path /gw/api/healthz" 200 "$(code "${PROXY}/gw/api/healthz")"

echo "--- header yang diterima app lewat gateway"
curl -s -H "Host: ${HOST}" "${PROXY}/blue" -o /dev/null -D - | grep -iE 'x-kong|ratelimit|x-correlation' || true

echo "--- rate limit /blue (limit 5/menit)"
last=200
for _ in 1 2 3 4 5 6 7; do last="$(code "${PROXY}/blue")"; done
check "request ke-7+ kena rate limit" 429 "$last"
