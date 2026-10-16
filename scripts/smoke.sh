#!/usr/bin/env bash
# Smoke test kontrak workload. Dipakai di CI/CD setelah deploy:
#   BASE_URL=https://playground.example.com bash scripts/smoke.sh
#   EXPECT_VERSION=v2 bash scripts/smoke.sh      (opsional: pastikan versi yang berjalan benar)
set -u
BASE_URL="${BASE_URL:-http://localhost:3000}"
EXPECT_VERSION="${EXPECT_VERSION:-}"
fail=0

code() { curl -s -o /dev/null -m 10 -w '%{http_code}' "$@"; }
check() { # nama, expected, actual
  if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 (expected $2, got $3)"; fail=1; fi
}

check "liveness"                 200 "$(code "$BASE_URL/api/healthz")"
check "readiness"                200 "$(code "$BASE_URL/api/readyz")"
check "startup"                  200 "$(code "$BASE_URL/api/startupz")"
check "info"                     200 "$(code "$BASE_URL/api/info")"
check "hello"                    200 "$(code "$BASE_URL/api/hello")"
check "status 503 diteruskan"    503 "$(code "$BASE_URL/api/status/503")"
check "status 404 diteruskan"    404 "$(code "$BASE_URL/api/status/404")"
check "flaky rate=100 gagal"     502 "$(code "$BASE_URL/api/flaky?rate=100&status=502")"
check "redirect rantai selesai"  200 "$(code -L "$BASE_URL/api/redirect?n=3")"
chaos="$(code -X POST "$BASE_URL/api/chaos/notready")"
if [ "$chaos" = "401" ] || [ "$chaos" = "403" ]; then echo "PASS  chaos terkunci tanpa token ($chaos)"; else echo "FAIL  chaos terkunci tanpa token (got $chaos)"; fail=1; fi

# Caching: respons punya validator dan revalidasi menghasilkan 304.
etag="$(curl -s -m 10 -D - -o /dev/null "$BASE_URL/api/cache?v=smoke" | tr -d '' | sed -n 's/^[Ee][Tt]ag: //p')"
if [ -n "$etag" ]; then
  check "cache revalidasi 304"   304 "$(code -H "If-None-Match: $etag" "$BASE_URL/api/cache?v=smoke")"
else
  echo "FAIL  cache tidak mengirim ETag"; fail=1
fi
check "cache no-store 200"       200 "$(code "$BASE_URL/api/cache?mode=nostore")"

# Auth: tanpa kredensial harus ditolak; identitas anonim tidak dianggap login.
check "whoami require=1 tanpa identitas" 401 "$(code "$BASE_URL/api/secure/whoami?require=1")"
check "jwt tanpa token ditolak"  401 "$(code "$BASE_URL/api/secure/jwt")"

# Multi-hop: tanpa UPSTREAM_URL app berperan sebagai leaf (200); dengan upstream sehat tetap 200.
check "chain"                    200 "$(code "$BASE_URL/api/chain?depth=2")"

if curl -s -m 10 -H 'apikey: smoke-secret' "$BASE_URL/api/headers" | grep -q 'smoke-secret'; then
  echo "FAIL  kredensial bocor di /api/headers"; fail=1
else
  echo "PASS  kredensial di-redact"
fi

if [ -n "$EXPECT_VERSION" ]; then
  got="$(curl -s -m 10 "$BASE_URL/api/info" | sed -n 's/.*"appVersion":"\([^"]*\)".*/\1/p')"
  check "versi = $EXPECT_VERSION" "$EXPECT_VERSION" "$got"
fi

exit "$fail"
