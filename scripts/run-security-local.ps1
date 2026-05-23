param(
  [string]$ZapTargetUrl = "",
  [switch]$IncludeZap
)

$ErrorActionPreference = "Stop"

Write-Host "[1/6] Semgrep SAST (repo)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/src" returntocorp/semgrep:latest semgrep scan --config=auto /src

Write-Host "[2/6] Gitleaks (full git history)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/repo" zricethezav/gitleaks:latest detect --source /repo --verbose

Write-Host "[3/6] Python Bandit (backend/api)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/work" -w /work/backend python:3.12-slim bash -lc "pip install -q bandit && bandit -r api -ll"

Write-Host "[4/6] Python pip-audit (backend deps)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/work" -w /work/backend python:3.12-slim bash -lc "pip install -q pip-audit && pip-audit -r requirements.txt"

Write-Host "[5/6] Frontend npm audit (high+)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/work" -w /work/frontend node:20 bash -lc "npm ci && npm audit --audit-level=high"

Write-Host "[6/6] Trivy filesystem scan (HIGH/CRITICAL)..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/work" aquasec/trivy:latest fs --severity HIGH,CRITICAL --ignore-unfixed /work

if ($IncludeZap) {
  if ([string]::IsNullOrWhiteSpace($ZapTargetUrl)) {
    throw "IncludeZap provided but ZapTargetUrl is empty. Use -ZapTargetUrl https://your-target"
  }
  Write-Host "[Optional] ZAP baseline black-box scan..." -ForegroundColor Cyan
  docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t $ZapTargetUrl
}

Write-Host "Security local scan completed." -ForegroundColor Green
