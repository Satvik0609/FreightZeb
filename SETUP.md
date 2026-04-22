# FreightZen — Setup Guide

## Prerequisites

- Node.js >= 20
- Python >= 3.11
- PostgreSQL database (Neon cloud recommended — free tier works)
- Kaggle account (for downloading training datasets)

---

## Step 1 — Clone the repo

```bash
git clone <your-repo-url>
cd FreightZen
```

---

## Step 2 — Backend

```bash
cd backend

# Copy environment template
cp .env.example .env
```

Open `.env` and fill in:
```env
DATABASE_URL="postgresql://user:pass@host:5432/freightzen"
JWT_SECRET="any-random-string-at-least-32-characters-long"
```

Then:
```bash
npm install
npx prisma db push        # creates all tables in your database
node prisma/seed.js       # seeds demo data (users, trucks, shipments)
npm run dev               # starts backend on http://localhost:5000
```

**Default login credentials after seeding:**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@freightzen.in | Admin@1234 |
| Warehouse | ops@bharat-logistics.in | Warehouse@1234 |
| Dealer | fleet@rajesh-transport.in | Dealer@1234 |

---

## Step 3 — ML Service

```bash
cd ml/service

# Install Python dependencies
pip install -r requirements.txt
```

### Download Kaggle datasets

The ML models need real datasets to train. Download them using the Kaggle API:

1. Go to https://www.kaggle.com/settings
2. Click **API** section → **Create New Token**
3. This downloads `kaggle.json`
4. Place it at:
   - Windows: `C:\Users\<you>\.kaggle\kaggle.json`
   - Mac/Linux: `~/.kaggle/kaggle.json`

Then run:
```bash
python scripts/download_datasets.py
```

### Retrain the fuel estimator

The fuel estimator model is too large for git (88MB). Retrain it once:

```bash
python -c "
from models.fuel_estimator_v2 import FuelEstimatorV2
FuelEstimatorV2(use_real_data=True, force_retrain=True)
print('Fuel estimator ready')
"
```

This takes about 2-3 minutes.

> **Note:** All other 5 models (truck, delivery, delay, clusterer, route) are already
> pre-trained and included in `saved_models/`. No retraining needed for those.

### Start the ML service

```bash
python app.py
```

ML service starts on http://localhost:8000
Interactive API docs at http://localhost:8000/docs

---

## Step 4 — Test with Postman

1. Open Postman
2. Click **Import** → select `FreightZen.postman_collection.json`
3. Run **Auth → 01 Register (ADMIN)** then **02 Login**
4. Token auto-saves — all other requests work automatically

---

## Quick Reference

| Service | URL | Command |
|---------|-----|---------|
| Backend API | http://localhost:5000 | `cd backend && npm run dev` |
| ML Service | http://localhost:8000 | `cd ml/service && python app.py` |
| ML Docs (Swagger) | http://localhost:8000/docs | (auto, when ML is running) |
| Prisma Studio (DB viewer) | http://localhost:5555 | `cd backend && npx prisma studio` |

---

## What's in the repo vs what you need to set up

| Item | In repo? | Action needed |
|------|----------|---------------|
| All backend code | Yes | Just `npm install` |
| All ML model code | Yes | Just `pip install` |
| 5 pre-trained models | Yes | Nothing |
| fuel_estimator model | No (88MB) | Retrain (Step 3) |
| Kaggle datasets | No (3GB+) | Download (Step 3) |
| `.env` secrets | No | Create from `.env.example` |
