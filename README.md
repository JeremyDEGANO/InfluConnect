# CollabSphere

A two-sided marketplace connecting brands with influencers.

## Tech Stack

- **Backend**: Django 5 + Django REST Framework + JWT Authentication
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL 16
- **Infrastructure**: Docker Compose

## Quick Start

### Prerequisites
- Docker & Docker Compose

### Run with Docker

```bash
# Clone the repository
git clone https://github.com/JeremyDEGANO/CollabSphere.git
cd CollabSphere

# Start all services
docker-compose up --build
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/api/
- **Django Admin**: http://localhost:8000/admin/

### Development Setup (without Docker)

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Set up PostgreSQL and create .env file
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Features

- **Two-sided marketplace**: Brands and influencers
- **Campaign management**: Gifting and paid collaborations
- **Proposal workflow**: From initial contact to payment
- **Escrow system**: Secure payment handling
- **Contract management**: Digital contract signing
- **Messaging**: In-app communication per proposal
- **Reviews**: Mutual rating system
- **Notifications**: Real-time notification system
- **Admin panel**: Platform administration
- **i18n**: English and French language support

## API Documentation

The REST API is available at `http://localhost:8000/api/`.

## Security Scanning

This repository includes a baseline security pipeline and local scanning script for white-box, grey-box, and black-box checks.

- CI workflow: `.github/workflows/security.yml`
- Local script: `scripts/run-security-local.ps1`
- Report template: `docs/security/SCAN_REPORT_TEMPLATE.md`

### Run local security scans (PowerShell)

```powershell
./scripts/run-security-local.ps1
```

Optional ZAP baseline against a public environment:

```powershell
./scripts/run-security-local.ps1 -IncludeZap -ZapTargetUrl https://staging.example.com
```

### CI usage

The security workflow runs automatically on push and pull request. You can also run a manual black-box ZAP baseline via `workflow_dispatch` by providing `zap_target_url`.

## License

MIT
