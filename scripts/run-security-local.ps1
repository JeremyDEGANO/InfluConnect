param(
  [string]$ZapTargetUrl = "",
  [switch]$IncludeZap
)

$ErrorActionPreference = "Stop"

Write-Host "[1/6] Semgrep SAST (repo)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/src" returntocorp/semgrep:latest@sha256:f1f7b71861c7b28b6e0f661225a2c4f58a484f5d0f182465c6d6b3b22f972ade semgrep scan --config=auto /src

Write-Host "[2/6] Gitleaks (full git history)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/repo" zricethezav/gitleaks:latest@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f detect --source /repo --verbose

Write-Host "[3/6] Python Bandit (backend/api)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/work" -w /work/backend python:3.12-slim@sha256:09f7da3bc104798d0afb40bc08d23ab2da20a76130cec1f2ef170848f5d85217 bash -lc "pip install -q bandit==1.9.4 && bandit -r api -ll"

Write-Host "[4/6] Python pip-audit (backend deps)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/work" -w /work/backend python:3.12-slim@sha256:09f7da3bc104798d0afb40bc08d23ab2da20a76130cec1f2ef170848f5d85217 bash -lc "pip install -q pip-audit==2.10.1 && pip-audit -r requirements.txt"

Write-Host "[5/6] Frontend npm audit (high+)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/work" -w /work/frontend node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 sh -lc "npm ci && npm audit --audit-level=high"

Write-Host "[6/6] Trivy filesystem scan (HIGH/CRITICAL)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/work" aquasec/trivy:latest@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969 fs --severity HIGH,CRITICAL --ignore-unfixed /work

if ($IncludeZap) {
  if ([string]::IsNullOrWhiteSpace($ZapTargetUrl)) {
    throw "IncludeZap provided but ZapTargetUrl is empty. Use -ZapTargetUrl https://your-target"
  }
  Write-Host "[Optional] ZAP baseline black-box scan..." -ForegroundColor Cyan
  docker run --rm -t ghcr.io/zaproxy/zaproxy:stable@sha256:781a2bdaea47324e7bab583e2263f21d257b0aee61ed51521a5be45f5f5081ef zap-baseline.py -t $ZapTargetUrl
}

Write-Host "Security local scan completed." -ForegroundColor Green
