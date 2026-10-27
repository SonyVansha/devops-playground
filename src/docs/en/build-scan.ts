import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'build-dan-scan',
  title: 'Build, test & scan',
  summary: 'Run tests and coverage, build the image, check its size, and scan with Trivy and SonarQube.',
  blocks: [
    { t: 'h', text: 'Test' },
    {
      t: 'code',
      code: 'npm run typecheck\nnpm test\nnpm run test:coverage     # writes lcov.info for SonarQube',
    },
    {
      t: 'check',
      title: 'All tests pass',
      command: 'npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"',
      expect: '`fail 0` and `pass` equals `tests`. The tests cover routes (including multi-hop over real HTTP), auth, cache, and the content of these docs.',
    },
    { t: 'h', text: 'Build image' },
    {
      t: 'code',
      code: 'docker build --pull -t devops-playground:1.0.0 .\n# to test ingress with a sub-path:\ndocker build --build-arg BASE_PATH=/playground -t devops-playground:1.0.0 .',
    },
    {
      t: 'check',
      title: 'Image size',
      command: 'docker images devops-playground:1.0.0 --format "{{.Size}}"',
      expect: 'about `242MB` on disk (≈ 56 MB compressed): about 200 MB is the Node runtime from the distroless base, and the app is ±27 MB. See the note in the README about `sharp` and `@swc/helpers` before changing the exclude list.',
    },
    {
      t: 'check',
      title: 'Image runs in strict mode',
      command: 'export MSYS_NO_PATHCONV=1   # Git Bash on Windows only\ndocker run -d --name dp --read-only --tmpfs /tmp --tmpfs /app/.next/cache --cap-drop ALL \\\n  --security-opt no-new-privileges -p 3000:3000 -m 256m devops-playground:1.0.0\nsleep 6; BASE_URL=http://localhost:3000 bash scripts/smoke.sh; docker rm -f dp',
      expect: 'all `PASS`. The container runs as user `65532` (nonroot), with a read-only filesystem and no capabilities.',
    },
    { t: 'h', text: 'Push to Docker Hub (GitHub Actions)' },
    {
      t: 'p',
      text: 'The workflow `.github/workflows/build-push.yml` builds the image and pushes it to Docker Hub. It **only runs when triggered manually** (`workflow_dispatch`). There is no automatic trigger from pushes or pull requests.',
    },
    {
      t: 'ol',
      items: [
        'On GitHub: Settings > Secrets and variables > Actions, create the secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (a Docker Hub Access Token with Read & Write permission).',
        'Optional: create the variable `DOCKERHUB_REPOSITORY` if the repository name differs from `devops-playground`.',
        'Open the Actions tab > Build and push image > Run workflow, pick a branch, fill in `tag` (empty = `sha-<7 commit characters>`), then run it.',
      ],
    },
    {
      t: 'table',
      head: ['Input', 'Purpose'],
      rows: [
        ['`tag`', 'image tag; empty = `sha-` + the first 7 characters of the commit'],
        ['`push_latest`', 'also push the `latest` tag'],
        ['`base_path`', 'the `BASE_PATH` build arg, e.g. `/playground` for deploying under a sub-path'],
        ['`run_tests`', 'run typecheck and tests before the build (enabled by default)'],
      ],
    },
    {
      t: 'check',
      title: 'Image is on Docker Hub',
      command: 'docker pull <username>/devops-playground:<tag>\ndocker run --rm -p 3000:3000 <username>/devops-playground:<tag>',
      expect: 'the image is pulled successfully and the app runs at `http://localhost:3000`. The GitHub run summary shows the `sha256:...` digest; use `image: <username>/devops-playground@sha256:...` in the manifest so the deployment does not change silently.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'The workflow does not scan the image with Trivy before pushing, and the actions use major version tags (`@v4`, `@v6`) instead of commit SHAs. For stricter environments, add a scan step and pin the actions to SHAs.',
    },
    { t: 'h', text: 'Trivy' },
    {
      t: 'code',
      code: 'trivy image --severity HIGH,CRITICAL devops-playground:1.0.0\ntrivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --skip-dirs node_modules --skip-dirs .next .\n# without installing Trivy:\ndocker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image devops-playground:1.0.0',
    },
    {
      t: 'check',
      title: 'Expected result',
      command: 'trivy image --severity HIGH,CRITICAL --exit-code 1 devops-playground:1.0.0; echo "exit=$?"',
      expect: '`Total: 0` for the OS (`debian 13`) and for `Node.js`, and `exit=0`. At the last measurement: 0 HIGH/CRITICAL vulnerabilities and 0 secrets; the Dockerfile and K8s manifests had 0 misconfigurations. This result only holds at the time of measurement; rescan periodically because new CVEs keep appearing.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'The `distroless/nodejs24-debian13` base was chosen because `debian12` carries a HIGH CVE in libssl3 that upstream has not yet updated. Pin the base image by digest in CI so builds are reproducible.',
    },
    { t: 'h', text: 'Reading platform scan results' },
    {
      t: 'p',
      text: 'If you deploy through a platform that scans builds (secrets, SCA, SAST, IaC, image), these are the common findings for this repo and how to handle them:',
    },
    {
      t: 'table',
      head: ['Finding', 'Meaning', 'Action'],
      rows: [
        ['`curl-auth-header` / `curl-auth-user` (gitleaks)', 'example `curl` commands that include literal credentials; low confidence', 'already replaced with variables in the scripts and docs, so it is no longer detected'],
        ['`KSV-0125` (Trivy IaC)', 'the image in the manifest uses an unknown registry (formerly `registry.example.com`)', 'the manifests now use `docker.io/your-dockerhub-user/...`, matching where CI pushes the image; replace `your-dockerhub-user` with your Docker Hub username. If you use another registry, register it as trusted in the Trivy policy or mark a waiver'],
        ['`DS-0026` (Trivy IaC)', 'Dockerfile without a `HEALTHCHECK`', 'already added using Node (distroless has no shell/curl); Kubernetes still uses probes'],
        ['Medium/low CVEs in `libc6`, `libgcc-s1`, `libstdc++6`, `zlib1g`', 'Debian packages from the distroless base image, with an empty fixed version column', 'cannot be fixed from the app side; the default policy only blocks critical findings that have a fix. Monitor, rebuild when the base is updated, or add a waiver'],
      ],
    },
    { t: 'h', text: 'SonarQube' },
    {
      t: 'code',
      code: 'npm run test:coverage\nsonar-scanner -Dsonar.host.url=<url> -Dsonar.token=<token>',
    },
    {
      t: 'p',
      text: '`sonar-project.properties` already points to `lcov.info`, excludes UI components and lifecycle files from coverage, and marks the test files. SonarQube has **never been run** against this repo, so real findings may appear; fix them based on its report.',
    },
  ],
};
