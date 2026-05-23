# Security Scan Report Template

## Scope
- Date:
- Reviewer:
- Environment:
- Commit SHA:
- App URL:
- API URL:

## Executive Summary
- Overall risk level: Low | Medium | High | Critical
- New critical findings:
- New high findings:
- Block release: Yes | No

## White Box (Code + Dependencies)
### Tools
- Semgrep
- Bandit
- pip-audit
- npm audit
- Gitleaks
- Trivy (fs/image)

### Findings
| ID | Severity | Type | Component | Evidence | Recommendation | Status |
|----|----------|------|-----------|----------|----------------|--------|
| WB-001 | HIGH | Dependency CVE | backend | CVE-XXXX | Upgrade package | Open |

## Grey Box (Authenticated Dynamic)
### Test Profile
- Auth method used:
- Test account role(s):
- Covered routes:

### Findings
| ID | Severity | Type | Endpoint/Flow | Evidence | Recommendation | Status |
|----|----------|------|---------------|----------|----------------|--------|
| GB-001 | HIGH | IDOR | /api/... | Response leak | Add object-level auth | Open |

## Black Box (Unauthenticated Dynamic)
### Tools
- ZAP baseline
- ZAP API scan

### Findings
| ID | Severity | Type | URL/Endpoint | Evidence | Recommendation | Status |
|----|----------|------|--------------|----------|----------------|--------|
| BB-001 | MEDIUM | Missing header | / | No CSP | Add CSP header | Open |

## Prioritization and SLA
- Critical: fix immediately (same day)
- High: fix within 7 days
- Medium: fix within 30 days
- Low: backlog with owner

## Decision
- Release approved: Yes | No
- Conditions:
- Follow-up date:
