# FreightZeb — Complete Setup Guide (Windows)

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | >= 20 | `node -v` |
| Python | >= 3.10 | `python --version` |
| PostgreSQL | Neon cloud (already in `.env`) | — |

> **No local database needed.** The project uses Neon cloud PostgreSQL.
> The `DATABASE_URL` is already set in `backend/.env`.

---

## Quick Start (3 Terminals)

Open **3 separate PowerShell terminals** and run one section in each.

---

### Terminal 1 — Backend

```powershell
cd "c:\Users\DELL\Desktop\updated_FreightZeb\FreightZeb\backend"
npm install
npm start
```

**Expected output:**
```
✅ Environment validated
🚛 FreightZeb API → http://localhost:5000
```

> **If you see `EPERM: operation not permitted` on `prisma generate`:**
> You do NOT need to run `prisma generate` to start the backend.
> Just run `npm start` directly. If it fails, kill all Node processes first:
> ```powershell
> taskkill /F /IM node.exe
> npm start
> ```

---

### Terminal 2 — ML Service

```powershell
cd "c:\Users\DELL\Desktop\updated_FreightZeb\FreightZeb\ml\service"
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

**Expected output:**
```
INFO: Application startup complete.
INFO: Uvicorn running on http://127.0.0.1:8000
```

> The ML service loads 7 pre-trained models on startup (takes ~15 seconds).
> All 6 `.joblib` model files are already included in `saved_models/`.

---

### Terminal 3 — Frontend

```powershell
cd "c:\Users\DELL\Desktop\updated_FreightZeb\FreightZeb\frontend"
npm install
npm run dev
```

**Expected output:**
```
VITE ready in ...ms
➜  Local:   http://localhost:5173/
```

---

## Verify everything is running

Open a **4th terminal** and run:

```powershell
python -c "import requests; print('Backend:', requests.get('http://127.0.0.1:5000/health', timeout=5).status_code); print('ML:', requests.get('http://127.0.0.1:8000/health', timeout=5).status_code)"
```

Expected: `Backend: 200` and `ML: 200`

Then open `http://localhost:5173` in your browser.

---

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@FreightZeb.in | Admin@1234 |
| Warehouse | ops@bharat-logistics.in | Warehouse@1234 |
| Dealer | fleet@rajesh-transport.in | Dealer@1234 |

---

## Service URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:5173 | React app |
| Backend API | http://localhost:5000 | Express / Prisma |
| ML Service | http://localhost:8000 | FastAPI |
| ML Swagger Docs | http://localhost:8000/docs | Interactive API docs |
| Prisma Studio | http://localhost:5555 | `cd backend && npx prisma studio` |

---

## Feature Walkthrough

### As Warehouse (`ops@bharat-logistics.in`)
1. Login → Dashboard shows your shipment stats and analytics
2. **Shipments** → Create New Shipment (fill in origin, destination, weight, GPS coords)
3. Open the shipment → click **Optimize** → AI ranks available trucks by score
4. Select a truck → **Create Booking** → dealer is notified in real-time
5. **ML Insights** → run Delivery Predictor, Delay Risk, Fuel Estimator, Cluster Shipments

### As Dealer (`fleet@rajesh-transport.in`)
1. Login → Dashboard shows your fleet stats and pending booking requests
2. **Trucks** → Register a new truck (fill in registration, type, capacity, route)
3. **Bookings** → Approve or Reject incoming requests
4. Approve → Assign → Picked Up → In Transit → Delivered
5. **Tracking** → Update GPS location for trucks in transit

### As Admin (`admin@FreightZeb.in`)
1. Login → Full system analytics
2. **Admin → Users** → manage all accounts
3. All shipments, trucks, bookings, invoices visible

### Invoices
- Invoices are **auto-created** when a booking reaches `DELIVERED` status
- Only visible to the Warehouse user (the one who booked) and Admin

### Notifications
- Real-time notifications appear in the bell icon (top right)
- Warehouse gets notified when booking is approved/rejected
- Dealer gets notified when a new booking request comes in

---

## One-Click Reset (if database gets messy)

```powershell
cd "c:\Users\DELL\Desktop\updated_FreightZeb\FreightZeb\backend"
node prisma/seed.js
```

This re-seeds all demo data without wiping existing users.

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `EPERM: operation not permitted` on prisma | Node process is locking the DLL | `taskkill /F /IM node.exe` then `npm start` |
| `Error loading ASGI app. Could not import module "app"` | Wrong working directory for uvicorn | `cd ml/service` first, then run uvicorn |
| Port 5173 already in use | Previous frontend still running | Close old terminal or kill: `taskkill /F /IM node.exe` |
| `401 Unauthorized` on all requests | Token expired | Log out and log back in |
| ML returns heuristic/fallback | ML service not running | Start Terminal 2 first |
| Analytics shows zeros | No seeded data yet | Run `node prisma/seed.js` |

---

## Development Tips

- **Prisma Studio** (database viewer): `cd backend && npx prisma studio` → opens at http://localhost:5555
- **ML Swagger UI**: http://localhost:8000/docs — test any ML endpoint directly
- **Backend logs**: printed in Terminal 1 (shows every API request + socket event)
- **Re-seed data**: `cd backend && node prisma/seed.js` (safe to run multiple times)
