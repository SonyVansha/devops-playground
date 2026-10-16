// k6: beban konstan ke /api/hello selama rollout/rolling update, untuk membuktikan zero-downtime
// dan melihat sebaran versi yang melayani.
//   k6 run -e BASE_URL=http://playground.local -e RATE=20 -e DURATION=2m loadtest/hello.js
//   docker run --rm -i -e BASE_URL=... grafana/k6 run - < loadtest/hello.js
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const served = new Counter('served_by_version');

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '2m',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // kurang dari 1% gagal berarti zero-downtime
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/hello`);
  check(res, { 'status 200': (r) => r.status === 200 });
  let version = 'unknown';
  try {
    version = res.json('version') || version;
  } catch (_) {
    // body bukan JSON (mis. error dari proxy)
  }
  served.add(1, { version });
}
