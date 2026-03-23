# InfluConnect

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
git clone https://github.com/JeremyDEGANO/InfluConnect.git
cd InfluConnect

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

## License

MIT
