import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'autentikasi',
  title: 'Authentication & identity',
  summary: 'Identity from the gateway, JWT claims (HS256 verification), and basic auth, plus how to create a token for testing.',
  blocks: [
    {
      t: 'table',
      head: ['Endpoint', 'Purpose', 'Configuration'],
      rows: [
        ['`/api/secure/whoami`', 'shows the identity from gateway headers (`X-Consumer-*`)', 'none; `?require=1` returns 401 if anonymous'],
        ['`/api/secure/jwt`', 'decodes JWT claims from `Authorization: Bearer`', '`JWT_SECRET` (optional) for HS256 verification'],
        ['`/api/secure/basic`', 'basic auth at the app level', '`BASIC_USER` + `BASIC_PASSWORD` (503 if empty)'],
      ],
    },
    {
      t: 'code',
      title: 'Fill in the secret (optional)',
      code: 'kubectl -n playground create secret generic playground-auth \\\n  --from-literal=jwt-secret="$(openssl rand -hex 24)" \\\n  --from-literal=basic-user=admin \\\n  --from-literal=basic-password="$(openssl rand -hex 12)"\nkubectl -n playground rollout restart deploy/playground',
    },
    { t: 'h', text: 'Identity from the gateway (whoami)' },
    {
      t: 'check',
      title: 'Anonymous rejected, consumer read',
      command: 'curl -s -o /dev/null -w "anonymous: %{http_code}\\n" "{{BASE}}/api/secure/whoami?require=1"\n# through the gateway (Kong key-auth or Envoy Gateway apiKeyAuth):\ncurl -s -H "Host: gateway.local" -H "apikey: <key>" "$PROXY/api/secure/whoami?require=1"',
      expect: 'directly to the app: `anonymous: 401`. Through the gateway: `"authenticated":true,"via":"gateway"`, `identityHeader` names the header that was used (`x-consumer-username` on Kong, `x-client-id` on Envoy Gateway), and `consumer.username` is filled in. Other header names can be watched through the env `IDENTITY_HEADERS`. The `Authorization` value is never returned, only its scheme (`Bearer`/`Basic`).',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'The `X-Consumer-*` headers are trusted as they are. `curl -H "X-Consumer-Username: siapa-saja" {{BASE}}/api/secure/whoami?require=1` sent directly to a pod returns 200. That is why direct access to pods must be restricted with a NetworkPolicy.',
    },
    { t: 'h', text: 'JWT' },
    { t: 'p', text: 'Create an HS256 token for testing (expires in 10 minutes). Use the same `JWT_SECRET` value as in the Secret.' },
    {
      t: 'code',
      title: 'Create a token',
      code: 'export JWT_SECRET=<value from the secret>\nb64u() { openssl base64 -A | tr \'+/\' \'-_\' | tr -d \'=\'; }\nH=$(printf \'{"alg":"HS256","typ":"JWT"}\' | b64u)\nP=$(printf \'{"sub":"alice","exp":%s}\' "$(( $(date +%s) + 600 ))" | b64u)\nS=$(printf \'%s.%s\' "$H" "$P" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64u)\nTOKEN="$H.$P.$S"',
    },
    {
      t: 'check',
      title: 'Valid token, wrong token, and no token',
      command: 'curl -s -o /dev/null -w "valid: %{http_code}\\n" -H "Authorization: Bearer $TOKEN" {{BASE}}/api/secure/jwt\ncurl -s -o /dev/null -w "secret wrong: %{http_code}\\n" -H "Authorization: Bearer $H.$P.${S}x" {{BASE}}/api/secure/jwt\ncurl -s -o /dev/null -w "tanpa token: %{http_code}\\n" {{BASE}}/api/secure/jwt',
      expect: '`valid: 200` (body `"verified":true`, `"expired":false`, `claims.sub` = `alice`), `secret wrong: 401` (`invalid signature`), `tanpa token: 401` with the header `WWW-Authenticate: Bearer`. A token with `alg: none` is also rejected.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'If `JWT_SECRET` is **not** set, the app only decodes the claims and answers `"verified":null` with a note that the gateway must do the verification. This suits testing a JWT/OIDC plugin on the gateway: make sure a forged token is rejected by the **gateway**, not the app. The raw token and signature are never returned.',
    },
    { t: 'h', text: 'Basic auth' },
    {
      t: 'check',
      title: 'Right and wrong credentials',
      command: 'export BASIC_USER=admin BASIC_PASSWORD=<password from the secret>\nGOOD=$(printf \'%s:%s\' "$BASIC_USER" "$BASIC_PASSWORD" | base64)\nBAD=$(printf \'%s:%s\' "$BASIC_USER" "wrong" | base64)\ncurl -s -o /dev/null -w "correct: %{http_code}\\n" -H "Authorization: Basic $GOOD" {{BASE}}/api/secure/basic\ncurl -s -o /dev/null -w "wrong: %{http_code}\\n" -H "Authorization: Basic $BAD" {{BASE}}/api/secure/basic\ncurl -si {{BASE}}/api/secure/basic | grep -i www-authenticate',
      expect: '`correct: 200`, `wrong: 401`, and the challenge `WWW-Authenticate: Basic realm="playground"`. If `BASIC_USER`/`BASIC_PASSWORD` are not set, the endpoint answers 503.',
    },
    {
      t: 'check',
      title: 'Credentials do not leak through /api/headers',
      command: 'curl -s -H "Authorization: Bearer $TOKEN" -H "apikey: $API_KEY" {{BASE}}/api/headers | grep -oE \'"(authorization|apikey)":"[^"]*"\'',
      expect: '`"authorization":"[REDACTED]"` and `"apikey":"[REDACTED]"`; the real values do not appear.',
    },
  ],
};
