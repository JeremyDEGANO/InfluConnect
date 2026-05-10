$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $root

$results = @()

function Add-Result {
  param(
    [string]$Step,
    [string]$Check,
    [bool]$Ok,
    [string]$Evidence
  )
  $results += [PSCustomObject]@{
    Step = $Step
    Check = $Check
    Status = if ($Ok) { "OK" } else { "FAIL" }
    Evidence = $Evidence
  }
}

function Has-Pattern {
  param(
    [string]$Path,
    [string]$Pattern
  )
  if (!(Test-Path $Path)) { return $false }
  return [bool](Select-String -Path $Path -Pattern $Pattern -Quiet)
}

# 1) Chronological DB order via migrations
$mig12 = "backend/api/migrations/0012_influencerprofile_gender.py"
$mig13 = "backend/api/migrations/0013_influencerprofile_content_links_and_more.py"
$mig14 = "backend/api/migrations/0014_brandprofile_agency_default_commission_percent_and_more.py"

Add-Result "1" "Migration 0012 exists" (Test-Path $mig12) $mig12
Add-Result "1" "Migration 0013 exists" (Test-Path $mig13) $mig13
Add-Result "1" "Migration 0014 exists" (Test-Path $mig14) $mig14

if ((Test-Path $mig13)) {
  $dep13 = Has-Pattern $mig13 "\('api', '0012_influencerprofile_gender'\)"
  Add-Result "1" "0013 depends on 0012" $dep13 "dependency chain"
}
if ((Test-Path $mig14)) {
  $dep14 = Has-Pattern $mig14 "\('api', '0013_influencerprofile_content_links_and_more'\)"
  Add-Result "1" "0014 depends on 0013" $dep14 "dependency chain"
}

# 2) Backend endpoints wired
$urls = "backend/api/urls.py"
Add-Result "2" "Route media-kit upload" (Has-Pattern $urls 'influencers/media-kit/upload') $urls
Add-Result "2" "Route brand onboarding" (Has-Pattern $urls 'brands/onboarding') $urls
Add-Result "2" "Route submit validation" (Has-Pattern $urls 'brands/submit-validation') $urls
Add-Result "2" "Route memberships" (Has-Pattern $urls 'brands/memberships') $urls
Add-Result "2" "Route delegations" (Has-Pattern $urls 'agency/delegations') $urls
Add-Result "2" "Route password-change" (Has-Pattern $urls 'auth/password-change') $urls
Add-Result "2" "Route 2fa reset" (Has-Pattern $urls 'auth/2fa/reset') $urls

# 3) Backend implementation files
Add-Result "3" "Team/Agency views file" (Test-Path "backend/api/_views_team_agency.py") "backend/api/_views_team_agency.py"
Add-Result "3" "Brand fields in models" (Has-Pattern "backend/api/models.py" 'is_agency|agency_default_commission_percent') "backend/api/models.py"
Add-Result "3" "Membership model in models" (Has-Pattern "backend/api/models.py" 'class BrandMembership') "backend/api/models.py"
Add-Result "3" "Delegation model in models" (Has-Pattern "backend/api/models.py" 'class AgencyDelegation') "backend/api/models.py"

# 4) Frontend routing and pages
$app = "frontend/src/App.tsx"
Add-Result "4" "Route /brand/team" (Has-Pattern $app '/brand/team') $app
Add-Result "4" "Route /brand/delegations" (Has-Pattern $app '/brand/delegations') $app
Add-Result "4" "Route /influencer/delegations" (Has-Pattern $app '/influencer/delegations') $app
Add-Result "4" "Route /brand/onboarding" (Has-Pattern $app '/brand/onboarding') $app
Add-Result "4" "Mfa reset confirm route" (Has-Pattern $app '/security/reset-mfa') $app

Add-Result "4" "Page Team exists" (Test-Path "frontend/src/pages/brand/Team.tsx") "frontend/src/pages/brand/Team.tsx"
Add-Result "4" "Page Delegations exists" (Test-Path "frontend/src/pages/brand/Delegations.tsx") "frontend/src/pages/brand/Delegations.tsx"
Add-Result "4" "Page Brand Onboarding exists" (Test-Path "frontend/src/pages/brand/Onboarding.tsx") "frontend/src/pages/brand/Onboarding.tsx"
Add-Result "4" "Page MFA reset confirm exists" (Test-Path "frontend/src/pages/MfaResetConfirm.tsx") "frontend/src/pages/MfaResetConfirm.tsx"

# 5) i18n parity EN/FR (basic key existence checks)
$i18n = "frontend/src/i18n.ts"
Add-Result "5" "EN+FR brand_team keys" ((Select-String -Path $i18n -Pattern 'brand_team:' -AllMatches).Count -ge 2) $i18n
Add-Result "5" "EN+FR agency keys" ((Select-String -Path $i18n -Pattern 'agency:' -AllMatches).Count -ge 2) $i18n
Add-Result "5" "EN+FR nav.team" ((Select-String -Path $i18n -Pattern 'team:' -AllMatches).Count -ge 2) $i18n
Add-Result "5" "EN+FR nav.delegations" ((Select-String -Path $i18n -Pattern 'delegations:' -AllMatches).Count -ge 2) $i18n
Add-Result "5" "EN+FR media_kit block" ((Select-String -Path $i18n -Pattern 'media_kit:' -AllMatches).Count -ge 2) $i18n

# 6) API client wiring
$apiExtra = "frontend/src/lib/apiExtra.ts"
Add-Result "6" "apiExtra memberships functions" (Has-Pattern $apiExtra 'fetchBrandMemberships|inviteBrandMember|revokeBrandMember') $apiExtra
Add-Result "6" "apiExtra delegations functions" (Has-Pattern $apiExtra 'fetchAgencyDelegations|createAgencyDelegation|actionAgencyDelegation') $apiExtra
Add-Result "6" "apiExtra brand onboarding functions" (Has-Pattern $apiExtra 'fetchBrandOnboarding|submitBrandForValidation') $apiExtra

# 7) Runtime checks (optional but useful)
$dockerAvailable = $false
try {
  $null = Get-Command docker -ErrorAction Stop
  $dockerAvailable = $true
} catch {
  $dockerAvailable = $false
}

if ($dockerAvailable) {
  try {
    $checkOutput = docker compose exec -T backend python manage.py check 2>&1
    $ok = ($LASTEXITCODE -eq 0)
    Add-Result "7" "Django system check" $ok (($checkOutput | Select-Object -Last 1) -join "")
  } catch {
    Add-Result "7" "Django system check" $false "docker compose exec failed"
  }
} else {
  Add-Result "7" "Django system check" $false "docker command not found"
}

# Render
$results | Sort-Object {[int]$_.Step}, Check | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status -eq "FAIL" })

Write-Host ""
if ($failed.Count -eq 0) {
  Write-Host "Verification status: OK (all checks passed)"
  exit 0
}

Write-Host "Verification status: FAIL ($($failed.Count) checks failed)"
Write-Host "Failed checks:"
$failed | ForEach-Object { Write-Host "- [Step $($_.Step)] $($_.Check) :: $($_.Evidence)" }
exit 1
