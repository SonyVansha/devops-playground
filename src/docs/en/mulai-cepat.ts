import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'mulai-cepat',
  title: 'Quick start',
  summary: 'Run the app locally, in Docker, or on Kubernetes, then confirm everything is healthy with one smoke test.',
  blocks: [
    { t: 'h', text: 'What is this app?' },
    {
      t: 'p',
      text: 'DevOps Playground is a **dummy workload**: a simple application that can deliberately be made healthy, slow, broken, or leak memory, so you can test your platform (Kubernetes, ingress, API gateway, rollouts, alerting, security scans) **before** the production application runs. The app is not a testing tool; you run the tests from the outside (kubectl, curl, k6, CI).',
    },
    { t: 'h', text: '1. Run' },
    {
      t: 'code',
      title: 'Local (dev)',
      code: 'npm ci\nnpm run dev          # http://localhost:3000',
    },
    {
      t: 'code',
      title: 'Docker (same as in the cluster: read-only, nonroot)',
      code: 'docker build --pull -t devops-playground:1.0.0 .\ndocker run --rm -p 3000:3000 --read-only --tmpfs /tmp --tmpfs /app/.next/cache \\\n  --cap-drop ALL --security-opt no-new-privileges devops-playground:1.0.0',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'In **Git Bash (Windows)**, paths like `/tmp` are automatically converted to Windows paths and `docker run` fails. Prefix the command with `export MSYS_NO_PATHCONV=1`.',
    },
    {
      t: 'code',
      title: 'Kubernetes',
      code: 'kubectl apply -f k8s/app.yaml\nkubectl -n playground rollout status deploy/playground\nkubectl -n playground port-forward svc/playground 3000:80',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Replace `image:` in `k8s/app.yaml` (`docker.io/your-dockerhub-user/devops-playground:1.0.0`, replace `your-dockerhub-user` with your Docker Hub username) with the image you pushed. The namespace uses Pod Security `restricted`, so pods must be nonroot and have no capabilities.',
    },
    { t: 'h', text: '2. Check that it is healthy' },
    {
      t: 'check',
      title: 'Contract smoke test',
      command: 'BASE_URL={{BASE}} bash scripts/smoke.sh',
      expect: 'every line starts with `PASS` and the script exits with code 0 (`echo $?` prints `0`).',
    },
    {
      t: 'check',
      title: 'One manual request',
      command: 'curl -s {{BASE}}/api/hello',
      expect: 'JSON `{"message":"hello","version":"dev","pod":...}`. The version and pod come from the env `APP_VERSION` and `POD_NAME`.',
    },
    { t: 'h', text: '3. Dashboard tour' },
    {
      t: 'ul',
      items: [
        '**Overview**: pod identity, live probe status, dependency, and the active behavior from env.',
        '**Scenarios & endpoints**: a catalog of deploy scenarios and endpoints, with copy buttons for `curl`.',
        '**Fault injection**: runtime chaos buttons (needs a token, see the Fault injection page).',
        '**Docs** (this page): the full guide and how to check things.',
      ],
    },
    { t: 'h', text: 'Repo structure' },
    {
      t: 'table',
      head: ['Location', 'Contents'],
      rows: [
        ['`src/app/api/*`', 'All endpoints (probe, hello, chain, secure, cache, chaos, etc.)'],
        ['`src/lib/*`', 'Shared logic: state, behavior (env), chaos guard, jwt, cache, chain, dependency'],
        ['`k8s/app.yaml`', 'Deployment, Service, Ingress, HPA, PDB, NetworkPolicy, sample ConfigMap'],
        ['`k8s/envoy-gateway/`', 'Envoy Gateway Gateway, HTTPRoute, and policies + `test.sh`'],
        ['`k8s/kong/`', 'Kong plugins and routes + `test.sh` (alternative)'],
        ['`k8s/rollouts/`', 'Argo Rollouts canary + analysis'],
        ['`k8s/chain/`', 'Three-tier chain (multi-hop)'],
        ['`scripts/smoke.sh`', 'Contract smoke test for CI/CD'],
        ['`loadtest/hello.js`', 'k6 load for the zero-downtime test'],
        ['`test/`', 'Unit and route tests (`npm test`)'],
      ],
    },
  ],
};
