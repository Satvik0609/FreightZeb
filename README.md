# FreightZeb — Complete System Documentation

> Full-stack logistics platform with AI-powered predictions.
> **Backend-v2** (Node.js / Express / Prisma / PostgreSQL) + **ML-v2** (Python / FastAPI / XGBoost / CatBoost / LightGBM)

---

## Current Project Status (May 2026)

Recent implementation completed in this project:

- Warehouse flow is active end-to-end: shipments, bookings, invoices, notifications.
- Dealer flow includes booking status actions, live tracking, truck maintenance toggle, and `Dealer Earnings`.
- Admin module includes:
  - `Admin Dashboard`
  - `Users`
  - `Finance Ops`
  - `Audit Logs`
  - `System Health`
  - Admin view of `Dealer Earnings`
- New analytics/admin APIs added for earnings and operations monitoring.
- Real-data workflow enabled:
  - `setup:dev` does not seed fake data.
  - `setup:demo` is available when demo seed data is needed.
  - `admin:bootstrap` script creates/updates real admin user.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Project Structure](#2-project-structure)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Environment Variables](#5-environment-variables)
6. [Running the Project](#6-running-the-project)
7. [Backend API — All Routes](#7-backend-api--all-routes)
   - [Auth](#71-auth--apíauth)
   - [Shipments](#72-shipments--apishipments)
   - [Trucks](#73-trucks--apitrucks)
   - [Bookings](#74-bookings--apibookings)
   - [Tracking](#75-tracking--apitracking)
   - [Analytics](#76-analytics--apianalytics)
   - [Notifications](#77-notifications--apinotifications)
   - [Invoices](#78-invoices--apiinvoices)
   - [Admin](#79-admin--apiadmin)
   - [Uploads](#710-uploads--apiuploads)
   - [ML / AI Predictions](#711-ml--ai--apiml)
8. [ML Service — All Endpoints](#8-ml-service--all-endpoints-port-8000)
9. [Internal Services](#9-internal-backend-services)
10. [Middleware](#10-middleware)
11. [Background Jobs (Cron)](#11-background-jobs-cron)
12. [Socket.io Real-Time Events](#12-socketio-real-time-events)
13. [ML Models Deep-Dive](#13-ml-models-deep-dive)
14. [Pricing Engine](#14-pricing-engine)
15. [Optimization Engine](#15-optimization-engine)
16. [Role-Based Access Control](#16-role-based-access-control-rbac)
17. [Request / Response Examples](#17-request--response-examples)
18. [Valid Enum Values](#18-valid-enum-values)
19. [Error Handling](#19-error-handling)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT                                  │
│              (Web / Mobile / API consumer)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              NODE.JS EXPRESS BACKEND  :5000                      │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │   Auth   │  │Shipments │  │  Trucks   │  │   Bookings    │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │ Tracking │  │Analytics │  │ Invoices  │  │ Notifications │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────────────┐  │
│  │ Uploads  │  │  Admin   │  │    ML / AI  (mlService.js)    │  │
│  └──────────┘  └──────────┘  └───────────────┬───────────────┘  │
│                                               │ axios POST       │
│  ┌───────────────────────┐                    │                  │
│  │  Prisma ORM           │◄───────────────────┘                  │
│  │  PostgreSQL           │                                        │
│  └───────────────────────┘                                        │
│  ┌───────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Socket.io (WS)       │  │  node-cron (3 background jobs)   │  │
│  └───────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │ HTTP (fallback-protected)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              PYTHON FASTAPI ML SERVICE  :8000                    │
│                                                                  │
│  POST /predict  (unified dispatcher)                            │
│  ├── truck_recommender     (XGBoost + LightGBM)                 │
│  ├── delivery_predictor    (XGBoost + CatBoost)                 │
│  ├── delay_predictor       (XGBoost + CatBoost)                 │
│  ├── fuel_estimator        (XGBoost + Random Forest)            │
│  ├── shipment_clusterer    (K-Means++ + DBSCAN)                 │
│  └── cargo_optimizer       (Knapsack algorithm)                 │
│                                                                  │
│  saved_models/*.joblib  ← pre-trained, load on startup          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
FreightZeb/
│
├── backend/
│   └── backend/
│       └── backend/                    ← Main Express backend root
│           ├── src/
│           │   ├── server.js           ← Entry point
│           │   ├── config/
│           │   │   ├── db.js           ← Prisma client + connect/disconnect
│           │   │   ├── env.js          ← ENV validation (fails fast on startup)
│           │   │   └── logger.js       ← Winston logger
│           │   ├── controllers/
│           │   │   ├── authController.js
│           │   │   ├── shipmentController.js
│           │   │   ├── truckController.js
│           │   │   ├── bookingController.js
│           │   │   ├── trackingController.js
│           │   │   ├── analyticsController.js
│           │   │   ├── notificationController.js
│           │   │   ├── invoiceController.js
│           │   │   ├── adminController.js
│           │   │   ├── uploadController.js
│           │   │   ├── consolidationController.js
│           │   │   ├── loadingController.js
│           │   │   └── mlController.js    ← [ADDED] ML predictions
│           │   ├── routes/
│           │   │   ├── authRoutes.js
│           │   │   ├── shipmentRoutes.js
│           │   │   ├── truckRoutes.js
│           │   │   ├── bookingRoutes.js
│           │   │   ├── trackingRoutes.js
│           │   │   ├── analyticsRoutes.js
│           │   │   ├── notificationRoutes.js
│           │   │   ├── invoiceRoutes.js
│           │   │   ├── adminRoutes.js
│           │   │   ├── uploadRoutes.js
│           │   │   ├── consolidationRoutes.js
│           │   │   ├── loadingRoutes.js
│           │   │   └── mlRoutes.js         ← [ADDED] ML routes
│           │   ├── services/
│           │   │   ├── mlService.js         ← [UPDATED] Calls FastAPI
│           │   │   ├── optimizationService.js
│           │   │   ├── pricingService.js
│           │   │   ├── routeService.js
│           │   │   ├── emailService.js
│           │   │   ├── notificationService.js
│           │   │   ├── shipmentService.js
│           │   │   ├── consolidationService.js
│           │   │   ├── loadingService.js
│           │   │   └── cronService.js
│           │   ├── middleware/
│           │   │   ├── authMiddleware.js    ← JWT protect + restrictTo
│           │   │   ├── rateLimiter.js       ← express-rate-limit
│           │   │   ├── errorMiddleware.js   ← notFound + errorHandler
│           │   │   ├── requestId.js         ← X-Request-ID tracing
│           │   │   ├── upload.js            ← multer config
│           │   │   └── validate.js          ← express-validator runner
│           │   ├── validators/
│           │   │   ├── authValidators.js
│           │   │   ├── shipmentValidators.js
│           │   │   ├── bookingValidators.js
│           │   │   ├── truckValidators.js
│           │   │   ├── trackingValidators.js
│           │   │   ├── consolidationValidators.js
│           │   │   └── loadingValidators.js
│           │   └── helpers/
│           ├── prisma/
│           │   ├── schema.prisma       ← Full DB schema (9 models)
│           │   └── seed.js             ← Dev seed data
│           ├── uploads/                ← Static file storage
│           ├── package.json
│           ├── .env.example
│           └── Dockerfile
│
├── ml/
│   └── ml-service/                     ← Python FastAPI ML service
│       ├── main.py                     ← FastAPI app + all endpoints
│       ├── models/
│       │   ├── __init__.py
│       │   ├── truck_recommender_v2.py
│       │   ├── delivery_predictor_v2.py
│       │   ├── shipment_clusterer_v2.py
│       │   ├── fuel_estimator_v2.py
│       │   ├── delay_predictor_v2.py
│       │   ├── route_optimizer_v2.py
│       │   ├── neural_delivery_predictor.py
│       │   ├── route_optimizer.py
│       │   ├── predictive_maintenance.py
│       │   └── model_persistence.py
│       ├── optimization/
│       │   └── cargo_optimizer.py
│       ├── saved_models/               ← Pre-trained .joblib files
│       │   ├── delay_predictor_v2.joblib      (7.6 MB)
│       │   ├── delivery_predictor_v2.joblib   (3.1 MB)
│       │   ├── fuel_estimator_v2.joblib       (21.2 MB)
│       │   ├── route_optimizer_v2.joblib
│       │   ├── shipment_clusterer_v2.joblib   (286 KB)
│       │   └── truck_recommender_v2.joblib    (3.0 MB)
│       ├── requirements.txt
│       └── Dockerfile
│
├── docker-compose.yml                  ← Runs both services together
└── README.md                           ← This file
```

---

## 3. Technology Stack

### Backend (Node.js)

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.19.2 | HTTP framework |
| @prisma/client | ^5.20.0 | ORM for PostgreSQL |
| jsonwebtoken | ^9.0.2 | JWT auth |
| bcryptjs | ^2.4.3 | Password hashing |
| socket.io | ^4.7.5 | Real-time WebSocket |
| axios | ^1.15.0 | HTTP client (calls ML service) |
| multer | ^2.1.1 | File uploads |
| helmet | ^8.1.0 | Security headers |
| cors | ^2.8.5 | CORS policy |
| compression | ^1.8.1 | Gzip responses |
| morgan | ^1.10.1 | HTTP request logging |
| winston | ^3.14.2 | Structured logging |
| express-rate-limit | ^8.3.2 | Rate limiting |
| express-validator | ^7.3.2 | Input validation |
| node-cron | ^3.0.3 | Scheduled jobs |
| nodemailer | ^8.0.5 | Email (SMTP) |
| uuid | ^13.0.0 | UUID generation |
| dotenv | ^16.4.5 | Environment variables |

### ML Service (Python)

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.109.0 | HTTP framework |
| uvicorn | 0.27.0 | ASGI server |
| pydantic | 2.5.3 | Data validation |
| scikit-learn | 1.4.0 | ML utilities, preprocessing |
| xgboost | 2.0.3 | Gradient boosted trees |
| lightgbm | 4.1.0 | Fast gradient boosting |
| catboost | 1.2.2 | Gradient boosting (categorical) |
| numpy | 1.26.3 | Numerical computing |
| pandas | 2.2.0 | Data manipulation |
| joblib | 1.3.2 | Model serialization |
| ortools | 9.8.3296 | Google OR-Tools (optimization) |

---

## 4. Database Schema

PostgreSQL database managed via Prisma ORM. 9 models:

### User
```
id, email (unique), password (hashed), name, role (ADMIN|WAREHOUSE|DEALER),
phone?, company?, avatarUrl?, passwordResetToken?, passwordResetExpiry?,
isActive (default: true), createdAt, updatedAt
```

### Shipment
```
id, warehouseId → User, weightKg, volumeM3?, boxes?,
pickupLocation (JSON: {lat, lng, address, city, pincode}),
destination    (JSON: {lat, lng, address, city, pincode}),
deadline?, description?, requirements? (JSON: {hazardous, fragile, tempControlled, oversized}),
status (PENDING|OPTIMIZED|BOOKED|IN_TRANSIT|DELIVERED|CANCELLED),
createdAt, updatedAt
```

### Truck
```
id, dealerId → User, registrationNo (unique), truckType (SMALL_VAN|CONTAINER_20FT|
CONTAINER_32FT|FLATBED_TRAILER|REEFER), capacityKg, capacityM3?,
routeFrom, routeTo, availability (bool), pricePerKm?,
currentLocation (JSON: {lat, lng, lastUpdated}),
status (AVAILABLE|BOOKED|IN_TRANSIT|MAINTENANCE), createdAt, updatedAt
```

### Booking
```
id, shipmentId → Shipment, truckId → Truck, warehouseId → User, dealerId → User,
status (REQUESTED|APPROVED|REJECTED|ASSIGNED|PICKED_UP|IN_TRANSIT|DELIVERED|CANCELLED),
optimScore?, distanceKm?, pricing (JSON: full pricing breakdown), estimatedEta?,
pickedUpAt?, deliveredAt?, notes?,
proofOfDelivery (JSON: {photos:[url], signature:url, notes, submittedAt}),
createdAt, updatedAt
```

### TrackingLog
```
id, bookingId → Booking, truckId → Truck,
latitude, longitude, status?, timestamp
```

### Notification
```
id, userId → User, type (string), title, message,
meta (JSON: {bookingId?, shipmentId?, ...}), isRead (bool), createdAt
```

### Invoice
```
id, bookingId → Booking (unique), userId → User, invoiceNo (unique),
pricing (JSON), status (PENDING|PAID|OVERDUE|CANCELLED),
issuedAt, paidAt?, dueDate?, notes?
```

### Prediction
```
id, shipmentId → Shipment,
type (ETA_HOURS|DELAY_RISK_PERCENT|RECOMMENDED_TRUCK_SCORE|FUEL_ESTIMATE_LITERS|CO2_KG),
value (Float), confidence?, modelVersion?, createdAt
```

### Entity Relationships
```
User (WAREHOUSE) ──< Shipment ──< Booking >── Truck ──> User (DEALER)
                                     │
                              TrackingLog
                              Invoice
Shipment ──< Prediction
User ──< Notification
```

---

## 5. Environment Variables

The `.env` file is already configured in `backend/.env`.  
Key variables:

```env
# ── Required ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require  # Neon cloud DB (already set)
JWT_SECRET="<min 32 characters>"                               # Already set

# ── Server ────────────────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173   # Vite dev server

# ── ML Service ────────────────────────────────────────────────────────────────
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_API_KEY=dev-ml-service-key
ML_TIMEOUT_MS=10000

# ── Email (optional — leave blank to skip) ────────────────────────────────────
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
```

The server **will not start** if `DATABASE_URL` or `JWT_SECRET` are missing.  
`JWT_SECRET` must be at least 32 characters.

---

## 6. Running the Project

> **Full setup guide with troubleshooting:** See [`SETUP.md`](./SETUP.md)

### Option A — One-Click (Windows PowerShell)

```powershell
# From the project root:
.\start.ps1
```

Opens 3 terminal windows automatically (Backend, ML Service, Frontend).  
Wait ~20 seconds, then open `http://localhost:5173`.

### Option B — Manual (3 terminals)

**Terminal 1 — Backend**
```powershell
cd backend
npm install
npm start
```
→ http://localhost:5000

**Terminal 2 — ML Service**
```powershell
cd ml\service
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```
→ http://localhost:8000 | Swagger: http://localhost:8000/docs

**Terminal 3 — Frontend**
```powershell
cd frontend
npm install
npm run dev
```
→ http://localhost:5173

### Login Credentials (demo data)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@FreightZeb.in | Admin@1234 |
| Warehouse | ops@bharat-logistics.in | Warehouse@1234 |
| Dealer | fleet@rajesh-transport.in | Dealer@1234 |

For production-like development without fake seed data:

```powershell
cd backend
npm run setup:dev
npm run admin:bootstrap
```

Use `npm run setup:demo` only when you explicitly want seeded demo records.

### Option C — Docker (one command)
```bash
# from project root
docker-compose up --build
```

Both backend + ML start together. ML service is health-checked before backend starts.

> **Windows EPERM error?** If `npm start` fails with `EPERM: operation not permitted`:
> ```powershell
> taskkill /F /IM node.exe
> npm start
> ```

---

## 7. Backend API — All Routes

**Base URL:** `http://localhost:5000`  
**Auth header:** `Authorization: Bearer <jwt_token>` (required on all protected routes)

---

### 7.1 Auth — `/api/auth`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/auth/register` | No | — | Register new user. Rate-limited (20 req/15min) |
| `POST` | `/api/auth/login` | No | — | Login, returns JWT token. Rate-limited |
| `POST` | `/api/auth/forgot-password` | No | — | Sends password reset email |
| `POST` | `/api/auth/reset-password` | No | — | Reset password using token from email |
| `GET` | `/api/auth/me` | ✅ | Any | Get current user profile |
| `PATCH` | `/api/auth/me` | ✅ | Any | Update profile (name, phone, company) |
| `PATCH` | `/api/auth/me/password` | ✅ | Any | Change password |

**Register body:**
```json
{
  "name": "Ravi Kumar",
  "email": "ravi@warehouse.com",
  "password": "SecurePass123!",
  "role": "WAREHOUSE",
  "phone": "+91-9876543210",
  "company": "Ravi Logistics"
}
```

**Login response:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": { "id": "uuid", "name": "Ravi", "email": "...", "role": "WAREHOUSE" }
}
```

---

### 7.2 Shipments — `/api/shipments`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/shipments` | ✅ | WAREHOUSE, ADMIN | Create a new shipment |
| `GET` | `/api/shipments/my` | ✅ | WAREHOUSE | List own shipments |
| `GET` | `/api/shipments` | ✅ | ADMIN | List all shipments |
| `GET` | `/api/shipments/:id` | ✅ | Any | Get single shipment by ID |
| `PATCH` | `/api/shipments/:id/cancel` | ✅ | Any | Cancel a shipment |
| `POST` | `/api/shipments/:id/optimize` | ✅ | WAREHOUSE, ADMIN | Run truck optimization engine |
| `GET` | `/api/shipments/consolidate` | ✅ | Any | ML-based shipment consolidation suggestions |

**Create shipment body:**
```json
{
  "weightKg": 8000,
  "volumeM3": 30,
  "boxes": 120,
  "pickupLocation": { "lat": 28.7041, "lng": 77.1025, "address": "Delhi Warehouse", "city": "Delhi", "pincode": "110001" },
  "destination": { "lat": 19.0760, "lng": 72.8777, "address": "Mumbai Port", "city": "Mumbai", "pincode": "400001" },
  "deadline": "2026-04-30T12:00:00Z",
  "description": "Electronics shipment",
  "requirements": { "hazardous": false, "fragile": true, "tempControlled": false, "oversized": false }
}
```

**Optimize response** — runs the optimization engine and returns scored truck recommendations:
```json
{
  "success": true,
  "eligible": 12,
  "distanceKm": 1415.3,
  "results": [
    {
      "truckId": "uuid",
      "registrationNo": "MH-01-AB-1234",
      "truckType": "CONTAINER_32FT",
      "score": 0.7842,
      "breakdown": { "utilizationScore": 0.88, "distanceMatchScore": 0.74, "costEfficiencyScore": 0.72, "co2Score": 0.51 },
      "distanceKm": 1415.3,
      "estimatedCost": 53781.40,
      "estimatedCo2Kg": 1019.0
    }
  ]
}
```

---

### 7.3 Trucks — `/api/trucks`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/trucks` | ✅ | DEALER, ADMIN | Register a new truck |
| `GET` | `/api/trucks/my` | ✅ | DEALER | List own trucks |
| `GET` | `/api/trucks/available` | ✅ | Any | List all available trucks |
| `GET` | `/api/trucks` | ✅ | ADMIN | List all trucks |
| `GET` | `/api/trucks/:id` | ✅ | Any | Get single truck |
| `PATCH` | `/api/trucks/:id` | ✅ | Any | Update truck details |
| `PATCH` | `/api/trucks/:id/location` | ✅ | DEALER, ADMIN | Push live GPS location |
| `DELETE` | `/api/trucks/:id` | ✅ | ADMIN | Delete truck |
| `POST` | `/api/trucks/optimize-loading` | ✅ | Any | ML-based cargo loading optimization |

**Create truck body:**
```json
{
  "registrationNo": "MH-01-AB-1234",
  "truckType": "CONTAINER_32FT",
  "capacityKg": 25000,
  "capacityM3": 75,
  "routeFrom": "Mumbai",
  "routeTo": "Delhi",
  "pricePerKm": 38
}
```

**Update location body:**
```json
{ "latitude": 21.1458, "longitude": 79.0882 }
```
→ Emits `truck:<truckId>` socket event to connected clients.

---

### 7.4 Bookings — `/api/bookings`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/bookings` | ✅ | WAREHOUSE, ADMIN | Create booking (links shipment + truck) |
| `GET` | `/api/bookings/my` | ✅ | WAREHOUSE | List own bookings |
| `GET` | `/api/bookings/dealer` | ✅ | DEALER | List bookings assigned to my trucks |
| `GET` | `/api/bookings` | ✅ | ADMIN | List all bookings |
| `GET` | `/api/bookings/:id` | ✅ | Any | Get single booking |
| `PATCH` | `/api/bookings/:id/status` | ✅ | Any | Update booking status |

**Create booking body:**
```json
{
  "shipmentId": "uuid",
  "truckId": "uuid"
}
```
→ Auto-calculates `distanceKm`, `pricing` (full breakdown), `estimatedEta`.  
→ Creates `Invoice` automatically.  
→ Emits `booking:<id>` and `user:<warehouseId>` socket events.  
→ Sends email notification to dealer.

**Booking status transitions:**
```
REQUESTED → APPROVED / REJECTED (by dealer)
APPROVED  → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED / CANCELLED
```

---

### 7.5 Tracking — `/api/tracking`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/tracking/update` | ✅ | DEALER, ADMIN | Push GPS location for a booking |
| `GET` | `/api/tracking/:bookingId` | ✅ | Any | Full location history |
| `GET` | `/api/tracking/:bookingId/latest` | ✅ | Any | Latest GPS location only |

**Push location body:**
```json
{
  "bookingId": "uuid",
  "truckId": "uuid",
  "latitude": 22.5726,
  "longitude": 88.3639,
  "status": "IN_TRANSIT"
}
```
→ Emits `booking:<bookingId>` socket event with `{ lat, lng, status, timestamp }`.

---

### 7.6 Analytics — `/api/analytics`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/api/analytics/warehouse` | ✅ | WAREHOUSE, ADMIN | Warehouse dashboard stats |
| `GET` | `/api/analytics/dealer` | ✅ | DEALER, ADMIN | Dealer / fleet dashboard stats |
| `GET` | `/api/analytics/dealer/earnings` | ✅ | DEALER, ADMIN | Dealer earnings KPIs + monthly trends + trip profitability |
| `GET` | `/api/analytics/admin/earnings` | ✅ | ADMIN | Platform dealer earnings intelligence for admin |
| `GET` | `/api/analytics/admin` | ✅ | ADMIN | Platform-wide stats |

**Warehouse analytics response:**
```json
{
  "analytics": {
    "totalShipments": 48,
    "byStatus": { "PENDING": 12, "BOOKED": 8, "IN_TRANSIT": 5, "DELIVERED": 23 },
    "deliveredCount": 23,
    "totalDistanceKm": 28450.5,
    "avgEtaHours": 18.4,
    "totalCo2SavedKg": 1240.2
  }
}
```

---

### 7.7 Notifications — `/api/notifications`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/api/notifications` | ✅ | Any | Get all my notifications |
| `PATCH` | `/api/notifications/read-all` | ✅ | Any | Mark all notifications as read |
| `PATCH` | `/api/notifications/:id/read` | ✅ | Any | Mark single notification as read |
| `DELETE` | `/api/notifications/:id` | ✅ | Any | Delete notification |

Notifications are auto-created on key events (booking requested, approved, delivered, etc.)  
They are also pushed via Socket.io to `user:<userId>` room.

---

### 7.8 Invoices — `/api/invoices`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/api/invoices/my` | ✅ | WAREHOUSE, ADMIN | List my invoices |
| `GET` | `/api/invoices` | ✅ | ADMIN | List all invoices |
| `GET` | `/api/invoices/:id` | ✅ | Any | Get single invoice |
| `PATCH` | `/api/invoices/:id/pay` | ✅ | ADMIN | Mark invoice as PAID |
| `PATCH` | `/api/invoices/:id/cancel` | ✅ | ADMIN | Cancel invoice |

Invoices are **auto-generated** when a booking is created. Format: `INV-<timestamp>-<random>`.

**Invoice pricing JSON structure:**
```json
{
  "ratePerKm": 38,
  "distanceKm": 1415.30,
  "baseCharge": 53781.40,
  "weightSurcharge": 2400.00,
  "fuelSurcharge": 4302.51,
  "subtotal": 60483.91,
  "gst": 10887.10,
  "total": 71371.01,
  "currency": "INR"
}
```

---

### 7.9 Admin — `/api/admin`

All admin routes require role `ADMIN`.

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/api/admin/users` | ✅ | ADMIN | List all users |
| `GET` | `/api/admin/users/:id` | ✅ | ADMIN | Get single user |
| `PATCH` | `/api/admin/users/:id/role` | ✅ | ADMIN | Change user role |
| `PATCH` | `/api/admin/users/:id/toggle` | ✅ | ADMIN | Activate / deactivate user |
| `DELETE` | `/api/admin/users/:id` | ✅ | ADMIN | Delete user |
| `GET` | `/api/admin/finance/summary` | ✅ | ADMIN | Finance Ops KPIs (revenue + invoice status summaries) |
| `GET` | `/api/admin/audit-logs` | ✅ | ADMIN | Aggregated platform audit stream |
| `GET` | `/api/admin/system-health` | ✅ | ADMIN | Runtime health (API, DB latency, memory, ML circuit) |

---

### 7.10 Uploads — `/api/uploads`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/uploads/proof/:bookingId` | ✅ | DEALER, ADMIN | Upload proof of delivery (photos + signature) |
| `GET` | `/api/uploads/proof/:bookingId` | ✅ | Any | View proof of delivery |
| `POST` | `/api/uploads/avatar` | ✅ | Any | Upload profile avatar |
| `DELETE` | `/api/uploads/avatar` | ✅ | Any | Delete avatar |
| `POST` | `/api/uploads/document/:shipmentId` | ✅ | WAREHOUSE, ADMIN | Attach document to shipment |

- **Proof of delivery:** accepts up to 5 photos + 1 signature (multipart/form-data)
- **Avatar:** single image file
- **Documents:** PDF, images
- Files stored in `uploads/` directory, served statically at `/uploads/<path>`

---

### 7.11 ML / AI — `/api/ml`

**Health and info endpoints are public (no auth required). All prediction routes require auth.**

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/api/ml/health` | No | — | ML service health status |
| `GET` | `/api/ml/models/info` | No | — | All model metadata + accuracy metrics |
| `POST` | `/api/ml/predict` | ✅ | Any | **Unified prediction endpoint** |
| `GET` | `/api/ml/recommend-truck` | ✅ | Any | Truck recommendation (query params) |
| `GET` | `/api/ml/predict-delivery/:shipmentId` | ✅ | Any | ETA prediction from DB shipment |
| `GET` | `/api/ml/cluster-shipments` | ✅ | Any | Cluster pending/active shipments |
| `GET` | `/api/ml/predict-delay/:shipmentId` | ✅ | Any | Delay risk from DB shipment |
| `GET` | `/api/ml/estimate-fuel` | ✅ | Any | Fuel estimation (query params) |
| `POST` | `/api/ml/optimize-cargo` | ✅ | Any | Cargo loading optimisation |

**Unified predict body:**
```json
{
  "prediction_type": "fuel | truck | delivery | delay | cluster | cargo",
  "... model-specific fields ..."
}
```

All predictions have **automatic heuristic fallbacks** if the ML service is unavailable. Fallback responses include `"fallback": true`.

---

## 8. ML Service — All Endpoints (Port 8000)

**Base URL:** `http://localhost:8000`  
**Interactive docs:** `http://localhost:8000/docs`

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check |
| `GET` | `/models/info` | All model metadata |
| `POST` | `/predict` | **Unified dispatcher** (NEW — added by integration) |

### V2 Model Endpoints (Pre-trained, Best Performance)

| Method | Path | Model | Accuracy |
|--------|------|-------|---------|
| `POST` | `/predict-truck` | XGBoost + LightGBM | 82.97% |
| `POST` | `/predict-delivery-time` | XGBoost + CatBoost | R²=0.941 |
| `POST` | `/predict-delay-risk` | XGBoost + CatBoost | 80.80%, AUC=0.943 |
| `POST` | `/estimate-fuel` | XGBoost + Random Forest | R²=0.973 |
| `POST` | `/cluster-shipments` | K-Means++ + DBSCAN | Silhouette=0.243 |
| `POST` | `/optimize-cargo` | Knapsack algorithm | — |

### Advanced / V1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/predict-delivery-neural` | Neural network with attention |
| `POST` | `/optimize-route` | RL + 2-opt route optimization |
| `POST` | `/predict-maintenance` | Predictive maintenance for trucks |
| `POST` | `/optimize-route-v2` | Genetic Algorithm + 2-opt |
| `GET` | `/v2/models/info` | V2 model metadata |
| `POST` | `/v2/predict-truck` | V2 truck recommendation |
| `POST` | `/v2/predict-delivery-time` | V2 delivery prediction |
| `POST` | `/v2/cluster-shipments` | V2 shipment clustering |
| `POST` | `/v2/estimate-fuel` | V2 fuel estimation |
| `POST` | `/v2/predict-delay-risk` | V2 delay risk |
| `POST` | `/v2/optimize-route` | V2 route optimization |

---

## 9. Internal Backend Services

### `mlService.js`
Proxy between Express and FastAPI. Every method has fallback heuristics.

| Method | ML endpoint | Fallback |
|--------|-------------|---------|
| `predictAll(type, payload)` | `POST /predict` | Routes to individual fallbacks |
| `predictTruckRecommendation(data)` | `POST /predict-truck` | Weight/volume threshold rules |
| `predictDeliveryTime(data)` | `POST /predict-delivery-time` | distance / 60 km/h |
| `clusterShipments(shipments)` | `POST /cluster-shipments` | 1 cluster (all together) |
| `predictDelayRisk(data)` | `POST /predict-delay-risk` | Weather + traffic risk table |
| `estimateFuel(data)` | `POST /estimate-fuel` | distance × truck_rate_per_km |
| `optimizeCargo(data)` | `POST /optimize-cargo` | Throws error (no heuristic) |
| `estimateCo2(km, type)` | Pure heuristic (no ML call) | — |
| `getHealth()` | `GET /health` | — |
| `getModelsInfo()` | `GET /models/info` | — |

### `optimizationService.js`
4-step truck matching pipeline for `POST /api/shipments/:id/optimize`:

1. **Load** — fetch all AVAILABLE trucks from DB
2. **Filter** — remove trucks that can't handle weight/volume/route
3. **Score** — weighted composite (utilization 35%, distance 25%, cost 25%, CO₂ 15%)
4. **Rank** — return top N by score

### `pricingService.js`
Freight cost calculator used on booking creation:

| Component | Logic |
|-----------|-------|
| Base charge | `max(rate_per_km × distance, ₹500 minimum)` |
| Weight surcharge | `₹0.8/kg above 5,000 kg threshold` |
| Fuel surcharge | `8% of base` |
| GST | `18% of subtotal` |
| Total | `base + weight + fuel + GST` (in INR) |

### `consolidationService.js`
Suggests which shipments can be combined into a single truck.

### `loadingService.js`
Calculates optimal cargo packing/stacking for a truck.

### `routeService.js`
Haversine formula for great-circle distance between two GPS coordinates.

### `emailService.js`
Nodemailer SMTP wrapper. Used for:
- Booking request notifications
- Password reset emails

### `notificationService.js`
Creates `Notification` records in DB and emits to Socket.io rooms.

### `shipmentService.js`
Shared shipment fetch utilities.

---

## 10. Middleware

| File | Purpose |
|------|---------|
| `authMiddleware.js` | `protect` — verifies JWT, sets `req.user = {id, email, role}` |
| | `restrictTo(...roles)` — checks `req.user.role` against allowed list |
| `rateLimiter.js` | `authLimiter` — 20 req per 15 min (auth routes) |
| | `apiLimiter` — 100 req per 1 min (all `/api` routes) |
| `errorMiddleware.js` | `notFound` — 404 handler, `errorHandler` — global 500 handler |
| `requestId.js` | Adds `X-Request-ID` header for log tracing |
| `upload.js` | Multer config: file type validation, size limits, path routing |
| `validate.js` | Runs `express-validator` result check, returns 422 on failure |

---

## 11. Background Jobs (Cron)

Three scheduled jobs start automatically on server boot:

| Job | Schedule | What it does |
|-----|----------|-------------|
| Overdue invoices | Daily 02:00 AM | Sets `PENDING` invoices past `dueDate` to `OVERDUE` |
| Token cleanup | Every hour | Clears expired password reset tokens from User records |
| Notification cleanup | Sunday 03:00 AM | Deletes `isRead=true` notifications older than 30 days |

---

## 12. Socket.io Real-Time Events

The server exposes a Socket.io server on the same port (5000).

### Rooms

| Room name | Who listens | Events emitted |
|-----------|-------------|---------------|
| `user:<userId>` | Individual user | `notification`, `booking_update` |
| `booking:<bookingId>` | Booking participants | `status_update`, `location_update` |
| `truck:<truckId>` | Truck followers | `location` |

### Client Usage

```javascript
const socket = io('http://localhost:5000');

// Join a room
socket.emit('join', 'booking:uuid-here');
socket.emit('join', 'user:my-user-id');

// Listen for events
socket.on('location_update', (data) => {
  // { lat, lng, status, timestamp }
});

socket.on('notification', (data) => {
  // { type, title, message, meta }
});

// Leave a room
socket.emit('leave', 'booking:uuid-here');
```

---

## 13. ML Models Deep-Dive

### Truck Recommender V2 (XGBoost + LightGBM Ensemble)
- **Input:** `weight_kg`, `volume_m3`, `distance_km`, `cargo_type`, `priority`
- **Output:** `recommended_truck` (one of 5 truck types), `confidence`, probabilities for all types
- **Accuracy:** 82.97% | **CV score:** trained with 5-fold cross-validation

### Delivery Time Predictor V2 (XGBoost + CatBoost Ensemble)
- **Input:** `weight_kg`, `distance_km`, `truck_type`, `traffic_condition`, `weather_condition`
- **Output:** `predicted_hours`, `confidence_interval`, `model_r2_score`, `model_mae`
- **R² Score:** 0.9410 | **MAE:** 1.82 hours

### Delay Risk Predictor V2 (XGBoost + CatBoost Ensemble)
- **Input:** `distance_km`, `weight_kg`, `truck_type`, `weather_condition`, `traffic_condition`, `time_of_day`
- **Output:** `risk_level` (LOW/MODERATE/HIGH/CRITICAL), `confidence`, `delay_probability` (%), `estimated_delay_hours`, probabilities per level
- **Accuracy:** 80.80% | **ROC AUC:** 0.9434

### Fuel Estimator V2 (XGBoost + Random Forest Ensemble)
- **Input:** `distance_km`, `weight_kg`, `truck_type`
- **Output:** `estimated_liters`, `estimated_cost` (USD), `co2_kg`
- **R² Score:** 0.9729 | **MAE:** 13.68 liters

### Shipment Clusterer V2 (K-Means++ + DBSCAN)
- **Input:** array of `{id, destination, weight_kg, volume_m3}`
- **Output:** cluster assignments, `n_clusters`, `silhouette_score`, per-cluster summary
- **Silhouette Score:** 0.2431

### Route Optimizer V2 (Genetic Algorithm + 2-opt)
- **Input:** `start` (lat/lng), `destinations` (array), optional `constraints`
- **Output:** optimized route order, `total_distance_km`, `improvement_percent`
- **Avg Improvement:** 42.2% over naive ordering

### Cargo Optimizer (Knapsack Algorithm)
- **Input:** `truck_capacity_kg`, `truck_capacity_m3`, `items` (array with weight, volume, value)
- **Output:** which items to load, `utilization_percent`, `total_weight`, `total_value`

### Model Persistence
All models use `ModelPersistence` class to save/load from `saved_models/*.joblib`.  
On startup → checks if `.joblib` file exists → loads it (< 6 seconds) → skips training.  
If `.joblib` missing → trains from scratch (5-15 min depending on model).

---

## 14. Pricing Engine

```
Freight cost = base + weight_surcharge + fuel_surcharge + GST

Base rate per km (₹):
  SMALL_VAN:       ₹12/km
  CONTAINER_20FT:  ₹28/km
  CONTAINER_32FT:  ₹38/km
  FLATBED_TRAILER: ₹42/km
  REEFER:          ₹55/km

Weight surcharge: ₹0.80/kg above 5,000 kg
Fuel surcharge:   8% of base charge
GST:              18% of subtotal
Minimum charge:   ₹500

Dealer's custom pricePerKm overrides the base rate if set.
```

---

## 15. Optimization Engine

Scoring formula (used in `POST /api/shipments/:id/optimize`):

```
score = 0.35 × utilization
      + 0.25 × distance_match
      + 0.25 × cost_efficiency
      + 0.15 × co2_score

where:
  utilization     = min((weight_util + vol_util) / 2, 1.0)
  distance_match  = 1 / (1 + distanceKm / 500)
  cost_efficiency = min(50 / pricePerKm, 1.0)         ← baseline ₹50/km
  co2_score       = 1 - (co2_per_km / 0.90)           ← REEFER is worst
```

CO₂ emission factors (kg/km):
- SMALL_VAN: 0.18 | CONTAINER_20FT: 0.55 | CONTAINER_32FT: 0.72
- FLATBED_TRAILER: 0.80 | REEFER: 0.90

---

## 16. Role-Based Access Control (RBAC)

Three roles exist: `ADMIN`, `WAREHOUSE`, `DEALER`

| Action | ADMIN | WAREHOUSE | DEALER |
|--------|-------|-----------|--------|
| Create shipment | ✅ | ✅ | ❌ |
| View own shipments | ✅ | ✅ | ❌ |
| View all shipments | ✅ | ❌ | ❌ |
| Register truck | ✅ | ❌ | ✅ |
| View available trucks | ✅ | ✅ | ✅ |
| Update truck location | ✅ | ❌ | ✅ |
| Create booking | ✅ | ✅ | ❌ |
| View dealer bookings | ✅ | ❌ | ✅ |
| Update booking status | ✅ | ✅ | ✅ |
| Upload proof of delivery | ✅ | ❌ | ✅ |
| Mark invoice paid | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| View all analytics | ✅ | ❌ | ❌ |
| Use ML predictions | ✅ | ✅ | ✅ |

---

## 17. Request / Response Examples

### Get JWT Token
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
```

### Unified ML Predict — Fuel
```bash
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "prediction_type": "fuel",
    "distance_km": 500,
    "weight_kg": 8000,
    "truck_type": "CONTAINER_20FT"
  }'
```

### Unified ML Predict — Delay Risk
```bash
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "prediction_type": "delay",
    "distance_km": 1200,
    "weight_kg": 12000,
    "truck_type": "CONTAINER_32FT",
    "weather_condition": "STORM",
    "traffic_condition": "HEAVY",
    "time_of_day": "NIGHT"
  }'
```

### Unified ML Predict — Truck Recommendation
```bash
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "prediction_type": "truck",
    "weight_kg": 15000,
    "volume_m3": 45,
    "distance_km": 800,
    "cargo_type": "GENERAL",
    "priority": "NORMAL"
  }'
```

### Estimate Fuel (query params)
```bash
curl "http://localhost:5000/api/ml/estimate-fuel?distance_km=500&weight_kg=8000&truck_type=CONTAINER_20FT" \
  -H "Authorization: Bearer <token>"
```

### Cargo Optimisation
```bash
curl -X POST http://localhost:5000/api/ml/optimize-cargo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "truck_capacity_kg": 25000,
    "truck_capacity_m3": 75,
    "items": [
      {"id": "p1", "weight_kg": 500, "volume_m3": 2, "value": 1000},
      {"id": "p2", "weight_kg": 8000, "volume_m3": 25, "value": 5000},
      {"id": "p3", "weight_kg": 3000, "volume_m3": 10, "value": 2500}
    ]
  }'
```

### ML Health (no auth)
```bash
curl http://localhost:5000/api/ml/health
# → { "success": true, "ml_service": { "status": "healthy", "models_loaded": true, "v2_models": 6 } }
```

---

## 18. Valid Enum Values

| Field | Valid Values |
|-------|-------------|
| `role` (User) | `ADMIN`, `WAREHOUSE`, `DEALER` |
| `truckType` | `SMALL_VAN`, `CONTAINER_20FT`, `CONTAINER_32FT`, `FLATBED_TRAILER`, `REEFER` |
| `truckStatus` | `AVAILABLE`, `BOOKED`, `IN_TRANSIT`, `MAINTENANCE` |
| `shipmentStatus` | `PENDING`, `OPTIMIZED`, `BOOKED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED` |
| `bookingStatus` | `REQUESTED`, `APPROVED`, `REJECTED`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED` |
| `invoiceStatus` | `PENDING`, `PAID`, `OVERDUE`, `CANCELLED` |
| `predictionType` | `ETA_HOURS`, `DELAY_RISK_PERCENT`, `RECOMMENDED_TRUCK_SCORE`, `FUEL_ESTIMATE_LITERS`, `CO2_KG` |
| ML `prediction_type` | `truck`, `delivery`, `delay`, `fuel`, `cluster`, `cargo` |
| ML `weather_condition` | `CLEAR`, `CLOUDY`, `RAIN`, `STORM`, `FOG`, `SNOW` |
| ML `traffic_condition` | `LIGHT`, `MODERATE`, `HEAVY`, `SEVERE` |
| ML `time_of_day` | `MORNING`, `AFTERNOON`, `EVENING`, `NIGHT` |
| ML `cargo_type` | `GENERAL`, `REFRIGERATED`, `HAZARDOUS`, `FRAGILE` |
| ML `priority` | `NORMAL`, `URGENT`, `EXPRESS` |

---

## 19. Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK |
| `201` | Created |
| `400` | Bad request / invalid input |
| `401` | Not authenticated (missing/invalid JWT) |
| `403` | Forbidden (wrong role) |
| `404` | Resource not found |
| `422` | Validation error (express-validator) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
| `503` | ML service unavailable (falls back to heuristic) |

### Error Response Shape
```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

### Validation Error Shape (422)
```json
{
  "success": false,
  "errors": [
    { "field": "weightKg", "message": "Weight must be a positive number" }
  ]
}
```

### ML Fallback Response
When the Python ML service is unreachable, predictions still return a 200 with heuristic estimates:
```json
{
  "success": true,
  "prediction_type": "fuel",
  "result": {
    "estimated_liters": 140.0,
    "estimated_cost": 210.0,
    "co2_kg": 275.0,
    "fallback": true,
    "reason": "ML service unavailable — linear rate estimate used"
  }
}
```