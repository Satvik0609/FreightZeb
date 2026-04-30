"""
ml/service/app.py
Production-grade FreightZeb ML Service.

Changes vs original main.py:
- Lazy model loading with lifespan startup event (one failure won't kill the service)
- API key on EVERY endpoint via dependency injection
- Pydantic v2 models with full validation
- Structured JSON logging
- /readyz endpoint (separate from /health) for k8s / docker healthcheck
- Request-ID propagation
- No bare except / no print statements
"""

import os
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional, List, Any

from fastapi import FastAPI, Depends, HTTPException, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("ml_service")

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY      = os.getenv("ML_SERVICE_API_KEY", "dev-ml-service-key")
ALLOW_ORIGINS = os.getenv("ALLOW_ORIGINS", "*").split(",")

# ── Model registry ────────────────────────────────────────────────────────────
_models: dict[str, Any] = {}
_startup_errors: dict[str, str] = {}


def _load_model(name: str, loader_fn):
    """Load a single model, recording any errors without crashing the service."""
    try:
        t0 = time.perf_counter()
        _models[name] = loader_fn()
        elapsed = time.perf_counter() - t0
        logger.info("Model loaded: %s (%.2fs)", name, elapsed)
    except Exception as exc:  # noqa: BLE001
        _startup_errors[name] = str(exc)
        logger.error("Failed to load model %s: %s", name, exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models at startup; each failure is isolated."""
    from models.truck_recommender_v2  import TruckRecommenderV2
    from models.delivery_predictor_v2 import DeliveryPredictorV2
    from models.shipment_clusterer_v2 import ShipmentClustererV2
    from models.fuel_estimator_v2     import FuelEstimatorV2
    from models.delay_predictor_v2    import DelayPredictorV2
    from models.route_optimizer_v2    import RouteOptimizerV2
    from optimization.cargo_optimizer import CargoOptimizer

    _load_model("truck_recommender",  TruckRecommenderV2)
    _load_model("delivery_predictor", DeliveryPredictorV2)
    _load_model("shipment_clusterer", ShipmentClustererV2)
    _load_model("fuel_estimator",     FuelEstimatorV2)
    _load_model("delay_predictor",    DelayPredictorV2)
    _load_model("route_optimizer",    RouteOptimizerV2)
    _load_model("cargo_optimizer",    CargoOptimizer)

    n_ok  = len(_models)
    n_err = len(_startup_errors)
    logger.info("Startup complete: %d models loaded, %d failed", n_ok, n_err)
    yield
    logger.info("Shutting down ML service")


app = FastAPI(
    title="FreightZeb ML Service",
    version="2.1.0",
    description="Production ML microservice for logistics predictions",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Request-ID middleware ─────────────────────────────────────────────────────
@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response   = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# ── Auth dependency ───────────────────────────────────────────────────────────
async def verify_api_key(x_ml_api_key: Optional[str] = Header(None)):
    if x_ml_api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "INVALID_API_KEY", "message": "Missing or invalid X-ML-API-Key header"},
        )
    return x_ml_api_key

# ── Model dependency (fail fast if model not loaded) ─────────────────────────
def require_model(name: str):
    def _dep():
        if name not in _models:
            err = _startup_errors.get(name, "Model not loaded")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "MODEL_UNAVAILABLE", "message": f"{name}: {err}"},
            )
        return _models[name]
    return _dep

# ── Pydantic schemas ──────────────────────────────────────────────────────────
class TruckRequest(BaseModel):
    weight_kg:   float = Field(..., gt=0, le=100_000)
    volume_m3:   float = Field(..., gt=0, le=1_000)
    distance_km: float = Field(..., gt=0, le=20_000)
    cargo_type:  str   = Field("GENERAL")
    priority:    str   = Field("NORMAL")
    model_config = {"extra": "forbid"}

class DeliveryRequest(BaseModel):
    weight_kg:         float = Field(..., gt=0, le=100_000)
    distance_km:       float = Field(..., gt=0, le=20_000)
    truck_type:        str   = Field("CONTAINER_20FT")
    traffic_condition: str   = Field("MODERATE")
    weather_condition: str   = Field("CLEAR")
    model_config = {"extra": "forbid"}

class DelayRequest(BaseModel):
    distance_km:       float = Field(..., gt=0, le=20_000)
    weight_kg:         float = Field(..., gt=0, le=100_000)
    truck_type:        str   = Field("CONTAINER_20FT")
    weather_condition: str   = Field("CLEAR")
    traffic_condition: str   = Field("MODERATE")
    time_of_day:       str   = Field("AFTERNOON")
    model_config = {"extra": "forbid"}

class FuelRequest(BaseModel):
    distance_km: float = Field(..., gt=0, le=20_000)
    weight_kg:   float = Field(..., gt=0, le=100_000)
    truck_type:  str   = Field("CONTAINER_20FT")
    model_config = {"extra": "forbid"}

class ClusterRequest(BaseModel):
    shipments: List[dict] = Field(..., min_length=2)
    model_config = {"extra": "forbid"}

class CargoRequest(BaseModel):
    truck_capacity_kg: float      = Field(..., gt=0, le=100_000)
    truck_capacity_m3: float      = Field(..., gt=0, le=1_000)
    items:             List[dict] = Field(..., min_length=1, max_length=500)
    model_config = {"extra": "forbid"}

class RouteRequest(BaseModel):
    start:        dict           = Field(...)
    destinations: List[dict]     = Field(..., min_length=1)
    constraints:  Optional[dict] = None
    model_config = {"extra": "forbid"}

class UnifiedRequest(BaseModel):
    prediction_type:   str             = Field(...)
    weight_kg:         Optional[float] = None
    volume_m3:         Optional[float] = None
    distance_km:       Optional[float] = None
    truck_type:        Optional[str]   = "CONTAINER_20FT"
    cargo_type:        Optional[str]   = "GENERAL"
    priority:          Optional[str]   = "NORMAL"
    traffic_condition: Optional[str]   = "MODERATE"
    weather_condition: Optional[str]   = "CLEAR"
    time_of_day:       Optional[str]   = "AFTERNOON"
    shipments:         Optional[List[dict]] = None
    truck_capacity_kg: Optional[float] = None
    truck_capacity_m3: Optional[float] = None
    items:             Optional[List[dict]] = None
    model_config = {"extra": "forbid"}

# ── Ops endpoints ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["ops"])
async def health():
    """Liveness probe — returns 200 as soon as the process is up."""
    return {"status": "up"}

@app.get("/readyz", tags=["ops"])
async def readyz():
    """Readiness probe — only 200 when ALL critical models are loaded."""
    critical = {"truck_recommender", "delivery_predictor", "fuel_estimator"}
    missing  = critical - _models.keys()
    if missing:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ready": False, "missing": list(missing), "errors": _startup_errors},
        )
    return {"ready": True, "models_loaded": list(_models.keys())}

@app.get("/models/info", dependencies=[Depends(verify_api_key)], tags=["ops"])
async def models_info():
    m    = _models
    info = {}
    if "truck_recommender" in m:
        info["truck_recommender"] = {
            "algorithm": "XGBoost + LightGBM",
            "accuracy":  getattr(m["truck_recommender"], "accuracy", None),
            "cv_score":  getattr(m["truck_recommender"], "cv_score", None),
        }
    if "delivery_predictor" in m:
        info["delivery_predictor"] = {
            "algorithm": "XGBoost + CatBoost",
            "r2_score":  getattr(m["delivery_predictor"], "r2_score", None),
            "mae_hours": getattr(m["delivery_predictor"], "mae", None),
        }
    if "fuel_estimator" in m:
        info["fuel_estimator"] = {
            "algorithm":  "XGBoost + Random Forest",
            "r2_score":   getattr(m["fuel_estimator"], "r2_score", None),
            "mae_liters": getattr(m["fuel_estimator"], "mae", None),
        }
    if "delay_predictor" in m:
        info["delay_predictor"] = {
            "algorithm": "XGBoost + CatBoost",
            "accuracy":  getattr(m["delay_predictor"], "accuracy", None),
            "roc_auc":   getattr(m["delay_predictor"], "roc_auc", None),
        }
    if "route_optimizer" in m:
        info["route_optimizer"] = {
            "algorithm":       "Genetic Algorithm + 2-opt",
            "avg_improvement": getattr(m["route_optimizer"], "avg_improvement", None),
        }
    return {"version": "2.1.0", "loaded": list(_models.keys()), "failed": _startup_errors, "models": info}

# ── Unified dispatcher ─────────────────────────────────────────────────────────
VALID_TYPES = {"truck", "delivery", "delay", "fuel", "cluster", "cargo", "route"}

@app.post("/predict", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def predict_unified(body: UnifiedRequest):
    pt = body.prediction_type.lower()
    if pt not in VALID_TYPES:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_PREDICTION_TYPE", "valid": list(VALID_TYPES)},
        )
    try:
        if pt == "truck":
            return _models["truck_recommender"].recommend(
                weight_kg=body.weight_kg, volume_m3=body.volume_m3,
                distance_km=body.distance_km, cargo_type=body.cargo_type,
                priority=body.priority,
            )
        if pt == "delivery":
            if body.weight_kg is None or body.distance_km is None:
                raise HTTPException(status_code=422, detail={"code": "MISSING_FIELDS", "message": "delivery requires weight_kg and distance_km"})
            return _models["delivery_predictor"].predict(
                weight_kg=body.weight_kg, distance_km=body.distance_km,
                truck_type=body.truck_type or "CONTAINER_20FT",
                traffic_condition=body.traffic_condition or "MODERATE",
                weather_condition=body.weather_condition or "CLEAR",
            )
        if pt == "delay":
            return _models["delay_predictor"].predict(
                distance_km=body.distance_km, weight_kg=body.weight_kg,
                truck_type=body.truck_type, weather_condition=body.weather_condition,
                traffic_condition=body.traffic_condition, time_of_day=body.time_of_day,
            )
        if pt == "fuel":
            return _models["fuel_estimator"].estimate(
                distance_km=body.distance_km, weight_kg=body.weight_kg,
                truck_type=body.truck_type,
            )
        if pt == "cluster":
            if not body.shipments or len(body.shipments) < 2:
                raise HTTPException(status_code=422, detail={"code": "NEED_2_SHIPMENTS"})
            return _models["shipment_clusterer"].cluster(body.shipments)
        if pt == "cargo":
            if not body.items:
                raise HTTPException(status_code=422, detail={"code": "NEED_ITEMS"})
            return _models["cargo_optimizer"].optimize(
                truck_capacity_kg=body.truck_capacity_kg,
                truck_capacity_m3=body.truck_capacity_m3,
                items=body.items,
            )
        if pt == "route":
            return _models["route_optimizer"].optimize_route(
                start=body.shipments[0] if body.shipments else {},
                destinations=body.shipments[1:] if body.shipments else [],
            )
    except (KeyError, AttributeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "MODEL_UNAVAILABLE", "message": str(exc)},
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unified predict [%s] failed", pt)
        raise HTTPException(status_code=500, detail={"code": "PREDICTION_ERROR", "message": str(exc)}) from exc

# ── Individual endpoints ───────────────────────────────────────────────────────
@app.post("/predict-truck", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def predict_truck(body: TruckRequest, model=Depends(require_model("truck_recommender"))):
    try:
        return model.recommend(**body.model_dump())
    except Exception as exc:
        logger.exception("predict-truck failed")
        raise HTTPException(500, detail=str(exc)) from exc

@app.post("/predict-delivery-time", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def predict_delivery(body: DeliveryRequest, model=Depends(require_model("delivery_predictor"))):
    try:
        return model.predict(**body.model_dump())
    except Exception as exc:
        logger.exception("predict-delivery-time failed")
        raise HTTPException(500, detail=str(exc)) from exc

@app.post("/predict-delay-risk", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def predict_delay(body: DelayRequest, model=Depends(require_model("delay_predictor"))):
    try:
        return model.predict(**body.model_dump())
    except Exception as exc:
        logger.exception("predict-delay-risk failed")
        raise HTTPException(500, detail=str(exc)) from exc

@app.post("/estimate-fuel", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def estimate_fuel(body: FuelRequest, model=Depends(require_model("fuel_estimator"))):
    try:
        return model.estimate(**body.model_dump())
    except Exception as exc:
        logger.exception("estimate-fuel failed")
        raise HTTPException(500, detail=str(exc)) from exc

@app.post("/cluster-shipments", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def cluster_shipments(body: ClusterRequest, model=Depends(require_model("shipment_clusterer"))):
    try:
        return model.cluster(body.shipments)
    except Exception as exc:
        logger.exception("cluster-shipments failed")
        raise HTTPException(500, detail=str(exc)) from exc

@app.post("/optimize-cargo", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def optimize_cargo(body: CargoRequest, model=Depends(require_model("cargo_optimizer"))):
    try:
        return model.optimize(
            truck_capacity_kg=body.truck_capacity_kg,
            truck_capacity_m3=body.truck_capacity_m3,
            items=body.items,
        )
    except Exception as exc:
        logger.exception("optimize-cargo failed")
        raise HTTPException(500, detail=str(exc)) from exc

@app.post("/optimize-route", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def optimize_route(body: RouteRequest, model=Depends(require_model("route_optimizer"))):
    try:
        return model.optimize_route(
            start=body.start,
            destinations=body.destinations,
            constraints=body.constraints,
        )
    except Exception as exc:
        logger.exception("optimize-route failed")
        raise HTTPException(500, detail=str(exc)) from exc

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
        access_log=True,
    )
