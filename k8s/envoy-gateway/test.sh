#!/usr/bin/env bash
# Tes skenario Envoy Gateway.
#   PROXY=http://<alamat-gateway> API_KEY=<key> bash k8s/envoy-gateway/test.sh
#   SLOW=1 ...     ikut menjalankan tes timeout dan streaming (butuh ±40 detik)
# Prasyarat: k8s/app.yaml dan k8s/envoy-gateway/routes.yaml sudah di-apply.
set -u
PROXY="${PROXY:-http://localhost:8080}"
HOST_HEADER="${HOST_HEADER:-gateway.local}"
API_KEY="${API_KEY:-}"
SLOW="${SLOW:-0}"
fail=0

pass() { echo "PASS  $1"; }
miss() { echo "FAIL  $1  ($2)"; fail=1; }
req() { curl -sS -m "${MAXTIME:-30}" -H "Host: ${HOST_HEADER}" "$@"; }
code() { req -o /dev/null -w '%{http_code}' "$@" 2>/dev/null; }
check() { # nama, diharapkan, aktual
  if [ "$2" = "$3" ]; then pass "$1 ($3)"; else miss "$1" "diharapkan $2, dapat $3"; fi
}
contains() { # nama, pola, teks
  if printf '%s' "$3" | grep -qiE -- "$2"; then pass "$1"; else miss "$1" "pola '$2' tidak ada"; fi
}

echo "### /blue: header dari gateway + rate limit 5/menit"
contains "header X-Gateway=envoy sampai ke app" 'x-gateway</dt><dd[^>]*>envoy' "$(req "${PROXY}/blue")"
last=200; for _ in 1 2 3 4 5 6 7; do last="$(code "${PROXY}/blue")"; done
check "request ke-8+ kena rate limit" 429 "$last"
echo "   (kuota 5/menit: tunggu 60 detik sebelum mengulang bagian ini)"

echo; echo "### /green: API key + CORS"
check "tanpa key ditolak" 401 "$(code "${PROXY}/green")"
check "key salah ditolak" 401 "$(code -H 'apikey: salah' "${PROXY}/green")"
if [ -n "${API_KEY}" ]; then
  check "key benar" 200 "$(code -H "apikey: ${API_KEY}" "${PROXY}/green")"
else
  echo "SKIP  key benar (isi API_KEY)"
fi
contains "CORS preflight membalas Allow-Origin" 'access-control-allow-origin: https://example.com' \
  "$(req -si -X OPTIONS -H 'Origin: https://example.com' -H 'Access-Control-Request-Method: GET' "${PROXY}/green" | head -30)"

echo; echo "### /gw: prefix dibuang"
contains "app menerima /api/gateway (bukan /gw/api/gateway)" '"receivedPath":"/api/gateway"' "$(req "${PROXY}/gw/api/gateway")"

echo; echo "### whoami: identitas dari API key"
check "tanpa key -> 401 (gateway menolak, atau app bila route tanpa policy)" 401 "$(code "${PROXY}/api/secure/whoami?require=1")"
if [ -n "${API_KEY}" ]; then
  W="$(req -H "apikey: ${API_KEY}" "${PROXY}/api/secure/whoami?require=1")"
  contains "app melihat consumer terautentikasi" '"authenticated":true' "$W"
  contains "identitas datang lewat header x-client-id" '"identityHeader":"x-client-id"' "$W"
fi

echo; echo "### Retry: /api/flaky?rate=30 (tanpa retry sekitar 30% gagal)"
failed=0; total=60
for _ in $(seq 1 "${total}"); do [ "$(code "${PROXY}/api/flaky?rate=30&status=503")" = 503 ] && failed=$((failed + 1)); done
if [ "${failed}" -le 6 ]; then pass "kegagalan turun berkat retry: ${failed} dari ${total} (tanpa retry diperkirakan ~18)"; else miss "retry tidak efektif" "${failed} dari ${total} gagal"; fi

echo; echo "### Kompresi di gateway: /api/cache?kb=200"
H="$(req -s -D - -o /dev/null -H 'Accept-Encoding: gzip' "${PROXY}/api/cache?kb=200")"
contains "Content-Encoding gzip dari gateway" 'content-encoding: gzip' "$H"
raw="$(req -s -o /dev/null -w '%{size_download}' -H 'Accept-Encoding: gzip' "${PROXY}/api/cache?kb=200")"
if [ "${raw:-0}" -lt 20000 ]; then pass "ukuran di jaringan kecil (${raw} byte dari ±200 KB)"; else miss "tidak terkompresi" "${raw} byte"; fi

echo; echo "### Sticky session: /api/cookie"
jar="$(mktemp)"; pods=""
for _ in $(seq 1 12); do pods="${pods}$(req -s -b "${jar}" -c "${jar}" "${PROXY}/api/cookie" | grep -o '"pod":"[^"]*"')"$'\n'; done
rm -f "${jar}"
n="$(printf '%s' "${pods}" | sort -u | grep -c .)"
if [ "${n}" = 1 ]; then pass "12 request dengan cookie jar dilayani 1 pod yang sama"; else miss "sticky session" "${n} pod berbeda"; fi
echo "   (bermakna bila replika >= 2; dengan 1 replika hasil ini selalu lulus)"

if [ "${SLOW}" = 1 ]; then
  echo; echo "### Timeout route (SLOW=1)"
  MAXTIME=60 check "/api/delay 20 dtk lolos (timeout route 35 dtk)" 200 "$(MAXTIME=60 code "${PROXY}/api/delay?ms=20000")"
  echo; echo "### Streaming tanpa batas waktu (SLOW=1)"
  n=0; done_evt=no
  while IFS= read -r line; do
    case "${line}" in id:*) n=$((n + 1)) ;; "event: done") done_evt=yes ;; esac
  done < <(req -sN -m 40 "${PROXY}/api/sse?events=18&interval=1000" 2>/dev/null)
  if [ "${n}" = 18 ] && [ "${done_evt}" = yes ]; then pass "stream 18 detik utuh (${n} event + done)"; else miss "stream terpotong" "${n} event, done=${done_evt}"; fi
else
  echo; echo "(lewati tes timeout dan streaming; jalankan dengan SLOW=1)"
fi

exit "${fail}"
