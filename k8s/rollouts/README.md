# Skenario canary (Argo Rollouts)

```bash
kubectl apply -f k8s/app.yaml
kubectl apply -f k8s/rollouts/rollout.yaml
kubectl argo rollouts get rollout playground -n playground --watch   # terminal 1
```

Catatan: Rollout mengambil alih Deployment (`workloadRef`, Deployment di-scale 0). Arahkan HPA ke Rollout
(`scaleTargetRef: {apiVersion: argoproj.io/v1alpha1, kind: Rollout, name: playground}`) agar tidak berebut kendali.

## 1. Canary sehat → dipromosikan

```bash
kubectl -n playground set env deploy/playground APP_VERSION=v2
```
Harapan: 20% → analisis lulus → 60% → analisis lulus → 100%, status `Healthy`.

## 2. Canary rusak → dibatalkan otomatis

```bash
kubectl -n playground set env deploy/playground APP_VERSION=v3 ERROR_RATE=30
```
Harapan: analisis gagal (success < 95%), Rollout `Degraded`, pod canary di-scale turun, stable (v2) tetap melayani.
Pulihkan template: `kubectl -n playground set env deploy/playground APP_VERSION=v2 ERROR_RATE-`

## 3. Canary lambat

```bash
kubectl -n playground set env deploy/playground APP_VERSION=v3 LATENCY_MS=8000
```
Harapan: curl timeout 5 dtk → success rendah → rollout dibatalkan.

## 4. Rollout tidak pernah siap

```bash
kubectl -n playground set env deploy/playground APP_VERSION=v3 BOOT_FAIL=true
```
Harapan: pod canary CrashLoopBackOff, rollout tertahan di step 1 sampai `progressDeadlineSeconds`.

## Beban tes selama rollout

`loadtest/hello.js` (k6) membuktikan tidak ada 5xx pada stable saat rollout berjalan dan menampilkan versi yang melayani:

```bash
k6 run -e BASE_URL=http://playground.local -e RATE=20 -e DURATION=3m loadtest/hello.js
```

Varian Prometheus (belum diuji): `analysis-prometheus.yaml`.
