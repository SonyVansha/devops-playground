import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'autentikasi',
  title: 'Autentikasi & identitas',
  summary: 'Identitas dari gateway, klaim JWT (verifikasi HS256), dan basic auth, plus cara membuat token untuk tes.',
  blocks: [
    {
      t: 'table',
      head: ['Endpoint', 'Fungsi', 'Konfigurasi'],
      rows: [
        ['`/api/secure/whoami`', 'menampilkan identitas dari header gateway (`X-Consumer-*`)', 'tidak ada; `?require=1` memberi 401 bila anonim'],
        ['`/api/secure/jwt`', 'mendekode klaim JWT dari `Authorization: Bearer`', '`JWT_SECRET` (opsional) untuk verifikasi HS256'],
        ['`/api/secure/basic`', 'basic auth di level app', '`BASIC_USER` + `BASIC_PASSWORD` (503 bila kosong)'],
      ],
    },
    {
      t: 'code',
      title: 'Isi secret (opsional)',
      code: 'kubectl -n playground create secret generic playground-auth \\\n  --from-literal=jwt-secret="$(openssl rand -hex 24)" \\\n  --from-literal=basic-user=admin \\\n  --from-literal=basic-password="$(openssl rand -hex 12)"\nkubectl -n playground rollout restart deploy/playground',
    },
    { t: 'h', text: 'Identitas dari gateway (whoami)' },
    {
      t: 'check',
      title: 'Anonim ditolak, consumer terbaca',
      command: 'curl -s -o /dev/null -w "anonim: %{http_code}\\n" "{{BASE}}/api/secure/whoami?require=1"\n# lewat gateway (Kong key-auth atau Envoy Gateway apiKeyAuth):\ncurl -s -H "Host: gateway.local" -H "apikey: <key>" "$PROXY/api/secure/whoami?require=1"',
      expect: 'langsung ke app: `anonim: 401`. Lewat gateway: `"authenticated":true,"via":"gateway"`, `identityHeader` menyebut header yang dipakai (`x-consumer-username` pada Kong, `x-client-id` pada Envoy Gateway), dan `consumer.username` terisi. Nama header lain bisa dipantau lewat env `IDENTITY_HEADERS`. Nilai `Authorization` tidak pernah dikembalikan, hanya skema-nya (`Bearer`/`Basic`).',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Header `X-Consumer-*` dipercaya apa adanya. `curl -H "X-Consumer-Username: siapa-saja" {{BASE}}/api/secure/whoami?require=1` langsung ke pod menghasilkan 200. Itulah kenapa akses langsung ke pod harus dibatasi NetworkPolicy.',
    },
    { t: 'h', text: 'JWT' },
    { t: 'p', text: 'Buat token HS256 untuk tes (kedaluwarsa 10 menit). Pakai nilai `JWT_SECRET` yang sama dengan di Secret.' },
    {
      t: 'code',
      title: 'Buat token',
      code: 'export JWT_SECRET=<isi dari secret>\nb64u() { openssl base64 -A | tr \'+/\' \'-_\' | tr -d \'=\'; }\nH=$(printf \'{"alg":"HS256","typ":"JWT"}\' | b64u)\nP=$(printf \'{"sub":"alice","exp":%s}\' "$(( $(date +%s) + 600 ))" | b64u)\nS=$(printf \'%s.%s\' "$H" "$P" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64u)\nTOKEN="$H.$P.$S"',
    },
    {
      t: 'check',
      title: 'Token valid, salah, dan tanpa token',
      command: 'curl -s -o /dev/null -w "valid: %{http_code}\\n" -H "Authorization: Bearer $TOKEN" {{BASE}}/api/secure/jwt\ncurl -s -o /dev/null -w "secret salah: %{http_code}\\n" -H "Authorization: Bearer $H.$P.${S}x" {{BASE}}/api/secure/jwt\ncurl -s -o /dev/null -w "tanpa token: %{http_code}\\n" {{BASE}}/api/secure/jwt',
      expect: '`valid: 200` (body `"verified":true`, `"expired":false`, `claims.sub` = `alice`), `secret salah: 401` (`invalid signature`), `tanpa token: 401` dengan header `WWW-Authenticate: Bearer`. Token `alg: none` juga ditolak.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Jika `JWT_SECRET` **tidak** diset, app hanya mendekode klaim dan menjawab `"verified":null` beserta catatan bahwa gateway yang harus memverifikasi. Cocok untuk menguji plugin JWT/OIDC di gateway: pastikan token palsu ditolak **gateway**, bukan app. Token mentah dan signature tidak pernah dikembalikan.',
    },
    { t: 'h', text: 'Basic auth' },
    {
      t: 'check',
      title: 'Kredensial benar dan salah',
      command: 'export BASIC_USER=admin BASIC_PASSWORD=<password dari secret>\nGOOD=$(printf \'%s:%s\' "$BASIC_USER" "$BASIC_PASSWORD" | base64)\nBAD=$(printf \'%s:%s\' "$BASIC_USER" "salah" | base64)\ncurl -s -o /dev/null -w "benar: %{http_code}\\n" -H "Authorization: Basic $GOOD" {{BASE}}/api/secure/basic\ncurl -s -o /dev/null -w "salah: %{http_code}\\n" -H "Authorization: Basic $BAD" {{BASE}}/api/secure/basic\ncurl -si {{BASE}}/api/secure/basic | grep -i www-authenticate',
      expect: '`benar: 200`, `salah: 401`, dan tantangan `WWW-Authenticate: Basic realm="playground"`. Bila `BASIC_USER`/`BASIC_PASSWORD` belum diisi, endpoint menjawab 503.',
    },
    {
      t: 'check',
      title: 'Kredensial tidak bocor lewat /api/headers',
      command: 'curl -s -H "Authorization: Bearer $TOKEN" -H "apikey: $API_KEY" {{BASE}}/api/headers | grep -oE \'"(authorization|apikey)":"[^"]*"\'',
      expect: '`"authorization":"[REDACTED]"` dan `"apikey":"[REDACTED]"`; nilai asli tidak muncul.',
    },
  ],
};
