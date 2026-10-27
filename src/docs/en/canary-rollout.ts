import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'canary-rollout',
  title: 'Canary (Argo Rollouts)',
  summary: 'Gradual release 20% → 60% → 100% with automatic analysis; a broken version is aborted on its own.',
  blocks: [
    {
      t: 'p',
      text: 'The Rollout uses the pod template from the `playground` Deployment (`workloadRef`), so you release a new version by changing the Deployment. The analysis is a `curl` Job that calls `/api/hello` on the canary Service 40 times. The canary is considered healthy if at least 95% of responses are 200.',
    },
    { t: 'h', text: 'Prerequisites' },
    {
      t: 'ul',
      items: [
        'The Argo Rollouts controller is installed in the cluster, along with the `kubectl argo rollouts` plugin.',
        '`k8s/app.yaml` has been applied (namespace `playground`).',
        'Point the HPA at the Rollout (`scaleTargetRef: {apiVersion: argoproj.io/v1alpha1, kind: Rollout, name: playground}`). Otherwise the HPA and the Rollout fight over control of the replicas.',
      ],
    },
    {
      t: 'code',
      code: 'kubectl apply -f k8s/rollouts/rollout.yaml\nkubectl argo rollouts get rollout playground -n playground --watch',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Without a traffic router (Kong, Envoy Gateway, Istio, NGINX), the canary weight follows the **number of pods** (20% of 5 replicas = 1 pod). The analysis is still accurate because it hits the canary Service directly.',
    },
    { t: 'h', text: 'Scenario A: healthy canary is promoted' },
    { t: 'code', code: 'kubectl -n playground set env deploy/playground APP_VERSION=v2' },
    {
      t: 'check',
      title: 'Full promotion',
      command: 'kubectl argo rollouts get rollout playground -n playground\ncurl -s {{BASE}}/api/hello | grep -o \'"version":"[^"]*"\'',
      expect: 'step 20% → analysis `Successful` → 60% → analysis `Successful` → 100%, status `Healthy`. The serving version becomes `v2`.',
    },
    { t: 'h', text: 'Scenario B: broken canary is aborted automatically' },
    { t: 'code', code: 'kubectl -n playground set env deploy/playground APP_VERSION=v3 ERROR_RATE=30' },
    {
      t: 'check',
      title: 'Rollout is aborted',
      command: 'kubectl argo rollouts get rollout playground -n playground\nkubectl -n playground get analysisrun',
      expect: 'AnalysisRun `Failed` (success rate < 95%), Rollout `Degraded`, the canary pods are scaled down, and stable (`v2`) keeps serving 100% of the traffic.',
    },
    {
      t: 'code',
      title: 'Restore the template',
      code: 'kubectl -n playground set env deploy/playground APP_VERSION=v2 ERROR_RATE-',
    },
    { t: 'h', text: 'Scenarios C and D' },
    {
      t: 'table',
      head: ['Scenario', 'Command', 'Result'],
      rows: [
        ['Slow canary', '`set env deploy/playground APP_VERSION=v3 LATENCY_MS=8000`', 'curl times out after 5 s → low success rate → aborted'],
        ['Never ready', '`set env deploy/playground APP_VERSION=v3 BOOT_FAIL=true`', 'canary pod CrashLoopBackOff, rollout stuck at step 1'],
      ],
    },
    { t: 'h', text: 'Proof of zero downtime with k6' },
    {
      t: 'check',
      title: 'Load during the rollout',
      command: 'k6 run -e BASE_URL={{BASE}} -e RATE=20 -e DURATION=3m loadtest/hello.js',
      expect: 'the `http_req_failed` and `http_req_duration` thresholds pass; the `served_by_version` metric shows a gradual shift from v2 → v3, with no error spike on stable.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'The Prometheus-based analysis variant (`k8s/rollouts/analysis-prometheus.yaml`) has not been tested. The `pod` label name depends on your scrape configuration. The `curlimages/curl` image in the analysis Job is not pinned by digest.',
    },
  ],
};
