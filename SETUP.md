# FreightZen Setup Guide

Complete step-by-step guide to set up FreightZen on your local machine or production server.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Setup](#docker-setup)
4. [Database Configuration](#database-configuration)
5. [Environment Variables](#environment-variables)
6. [Running the Application](#running-the-application)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- Node.js 18.x or higher
- Python 3.11 or higher
- PostgreSQL 15 or higher
- Git

### Optional (for Docker deployment)
- Docker 20.x or higher
- Docker Compose 2.x or higher

## Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Satvik0609/FreightZen.git
cd FreightZen
```

### 2. Set Up PostgreSQL Database

#### Option A: Using Docker
```bash
docker run -d \
  --name freightzen-postgres \
  -e POSTGRES_USER=freightzen \
  -e POSTGRES_PASSWORD=freightzen123 \
  -e POSTGRES_DB=freightzen \
  -p 5432:5432 \
  postgres:15-alpine
```

#### Option B: Local PostgreSQL Installation
```bash
# Create database
createdb freightzen

# Create user
psql -c "CREATE USER freightzen WITH PASSWORD 'freightzen123';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE freightzen TO freightzen;"
```

### 3. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env file with your configuration
# DATABASE_URL="postgresql://freightzen:freightzen123@localhost:5432/freightzen"
# JWT_SECRET="your-secret-key"
# ML_SERVICE_URL="http://localhost:8000"

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

Backend will run on http://localhost:5000

### 4. ML Service Setup

```bash
cd ml-service

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start ML service
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

ML Service will run on http://localhost:8000

### 5. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will run on http://localhost:3000

## Docker Setup

### Quick Start
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Build and Run
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check service health
docker-compose ps
```

### Access Services
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- ML Service: http://localhost:8000
- PostgreSQL: localhost:5432

## Database Configuration

### Initialize Database
```bash
cd backend
npx prisma db push
```

### View Database
```bash
npx prisma studio
```

### Reset Database (Development Only)
```bash
npx prisma db push --force-reset
```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://freightzen:freightzen123@localhost:5432/freightzen"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
ML_SERVICE_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"
NODE_ENV="development"
PORT=5000
LOG_LEVEL="info"
```

### ML Service
No environment file needed for development. Configure via command line or Docker.

### Frontend
API proxy configured in vite.config.js - no environment file needed.

## Running the Application

### Development Mode

Terminal 1 - Database:
```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=freightzen \
  -e POSTGRES_PASSWORD=freightzen123 \
  -e POSTGRES_DB=freightzen \
  postgres:15-alpine
```

Terminal 2 - Backend:
```bash
cd backend
npm run dev
```

Terminal 3 - ML Service:
```bash
cd ml-service
uvicorn main:app --reload
```

Terminal 4 - Frontend:
```bash
cd frontend
npm run dev
```

### Production Mode

```bash
# Using Docker Compose
docker-compose up -d

# Or build for production
cd frontend && npm run build
cd backend && npm start
cd ml-service && uvicorn main:app --host 0.0.0.0 --port 8000
```

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql -h localhost -U freightzen -d freightzen

# Check DATABASE_URL in .env
cat backend/.env | grep DATABASE_URL
```

### ML Service Not Responding
```bash
# Check service is running
curl http://localhost:8000/health

# Check logs
docker-compose logs ml-service

# Restart service
docker-compose restart ml-service
```

### Frontend Build Errors
```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

### Port Already in Use
```bash
# Find process using port
lsof -i :5000  # Backend
lsof -i :8000  # ML Service
lsof -i :3000  # Frontend

# Kill process
kill -9 <PID>
```

### Prisma Issues
```bash
# Regenerate Prisma client
cd backend
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma db push --force-reset
```

## Verification

### Test Backend API
```bash
# Health check
curl http://localhost:5000/api/auth/login

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
```

### Test ML Service
```bash
# Health check
curl http://localhost:8000/health

# Test truck recommendation
curl -X POST http://localhost:8000/predict-truck \
  -H "Content-Type: application/json" \
  -d '{"weight_kg":5000,"volume_m3":15,"distance_km":200,"cargo_type":"GENERAL"}'
```

### Test Frontend
Open http://localhost:3000 in your browser and:
1. Register a new account
2. Login
3. Create a shipment
4. View dashboard

## Next Steps

After successful setup:
1. Create test data using Prisma Studio
2. Explore the API documentation
3. Test ML predictions
4. Customize the application for your needs

## Support

For issues or questions:
- Check the main README.md
- Review error logs
- Open an issue on GitHub
