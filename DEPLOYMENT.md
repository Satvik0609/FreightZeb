# FreightZen Deployment

## Services

- `backend`: Express API on port `5000`
- `ml/service`: FastAPI ML service on port `8000`
- `postgres`: PostgreSQL

## Required environment

Use [backend/.env.production.example](/C:/Users/Atul/OneDrive/Desktop/New folder (2)/FreightZen/backend/.env.production.example) as the production template.

Critical variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `ML_SERVICE_URL`
- `ML_SERVICE_API_KEY`

## Docker Compose

From the repo root:

```bash
docker compose up --build -d
```

This starts:

- PostgreSQL
- ML service
- Prisma migration job
- backend API

## Health checks

- Backend: `GET /health`
- ML live: `GET http://localhost:8000/health`
- ML ready: `GET http://localhost:8000/readyz`
- Backend ML aggregation: `GET /api/ml/health`

## Production checklist

1. Set a real `JWT_SECRET`.
2. Set the same `ML_SERVICE_API_KEY` in backend and ML service.
3. Point `FRONTEND_URL` to the deployed frontend origin.
4. Use a managed Postgres instance or persistent Docker volume backups.
5. Run `npx prisma migrate deploy` before serving traffic if you use migrations.
6. Keep `saved_models/` available to the ML container.

## Notes

- Endpoints with heuristic fallbacks still return usable values if ML is unavailable.
- Cargo optimization does not have a fallback and returns `503` when ML is unavailable.
- Analytics chart endpoints are available at:
  - `/api/analytics/warehouse/charts`
  - `/api/analytics/dealer/charts`
  - `/api/analytics/admin/charts`
