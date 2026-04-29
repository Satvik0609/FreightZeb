"""
Binary Delay Risk Predictor — v3 (production rewrite).

Architecture:
  Binary classification: delay = 1 if actual_hours > expected_hours * 1.15 else 0

  Models:
    - Logistic Regression (calibrated with isotonic regression for reliable proba)
    - Gradient Boosting Classifier
    - Ensemble: LR * 0.4 + GBM * 0.6

  Features (21 total):
    [0]    distance_km  (StandardScaler)
    [1]    weight_kg    (StandardScaler)
    [2-6]  truck_type   OHE (5 types)
    [7-12] weather      OHE (6 types)
    [13-16] traffic     OHE (4 types)
    [17-20] time_of_day OHE (4 types)

  Inference:
    delay_probability = predict_proba()[1] * 100   (true calibrated probability)
    risk_level: 0-25 LOW | 26-50 MODERATE | 51-75 HIGH | 76-100 CRITICAL

  Breakdown:
    feature_contributions via LR coefficient * scaled feature value
    (additive log-odds contribution per feature group, converted to % contribution)
"""

import logging
import os
from datetime import datetime
from typing import Dict

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split

from .model_persistence import ModelPersistence

logger = logging.getLogger(__name__)

# Use a new model name so old XGBoost/CatBoost artifacts are never loaded.
_MODEL_NAME = "delay_predictor_v4"


class DelayPredictorV2:
    """
    Binary delay risk predictor.
    The class name is kept as DelayPredictorV2 so app.py needs no changes.
    """

    TRUCK_TYPES = ["SMALL_VAN", "CONTAINER_20FT", "CONTAINER_32FT", "FLATBED_TRAILER", "REEFER"]
    WEATHER_CONDITIONS = ["CLEAR", "CLOUDY", "RAIN", "STORM", "FOG", "SNOW"]
    TRAFFIC_CONDITIONS = ["LIGHT", "MODERATE", "HEAVY", "SEVERE"]
    TIME_OF_DAY_VALUES = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"]

    # Fixed feature-group index ranges (must stay in sync with _build_X_row)
    _FEATURE_GROUPS: Dict[str, list] = {
        "distance":    [0],
        "weight":      [1],
        "truck_type":  [2, 3, 4, 5, 6],
        "weather":     [7, 8, 9, 10, 11, 12],
        "traffic":     [13, 14, 15, 16],
        "time_of_day": [17, 18, 19, 20],
    }
    _N_FEATURES = 21  # 2 numeric + 5 + 6 + 4 + 4

    def __init__(self, force_retrain: bool = False):
        self.scaler = None
        self.lr_model = None   # CalibratedClassifierCV(LogisticRegression)
        self.gbm_model = None  # GradientBoostingClassifier
        self._lr_coef = None   # plain LR coef for explanations
        self._lr_intercept = 0.0
        
        self.is_trained = False
        self.accuracy = 0.0
        self.roc_auc = 0.0
        self.brier_score = 1.0
        self.training_date = None

        if not force_retrain and self._load_pretrained():
            logger.info(
                "✓ Delay Predictor (binary) loaded — AUC: %.4f  Brier: %.4f",
                self.roc_auc,
                self.brier_score,
            )
                else:
            logger.info("Training new binary Delay Predictor ...")
            self._train()
            self._save()
            logger.info(
                "✓ Delay Predictor trained — AUC: %.4f  Brier: %.4f",
                self.roc_auc,
                self.brier_score,
            )

    # ── Feature construction ─────────────────────────────────────────────────

    def _build_X_row(
        self,
        distance_km: float,
        weight_kg: float,
        truck_type: str,
        weather_condition: str,
        traffic_condition: str,
        time_of_day: str,
    ) -> np.ndarray:
        """Return a (1, 21) feature matrix for a single prediction."""
        from sklearn.preprocessing import StandardScaler  # local to avoid circular
        num_scaled = self.scaler.transform([[distance_km, weight_kg]])[0]

        truck_ohe   = (np.array(self.TRUCK_TYPES)        == truck_type).astype(float)
        weather_ohe = (np.array(self.WEATHER_CONDITIONS) == weather_condition).astype(float)
        traffic_ohe = (np.array(self.TRAFFIC_CONDITIONS) == traffic_condition).astype(float)
        time_ohe    = (np.array(self.TIME_OF_DAY_VALUES) == time_of_day).astype(float)

        row = np.concatenate([num_scaled, truck_ohe, weather_ohe, traffic_ohe, time_ohe])
        return row.reshape(1, -1)

    def _build_X_batch(self, df: pd.DataFrame) -> np.ndarray:
        """Build full feature matrix from a DataFrame (must have scaler fitted first)."""
        num_scaled = self.scaler.transform(df[["distance_km", "weight_kg"]].values)
        rows = []
        for i, row in enumerate(df.itertuples(index=False)):
            truck_ohe   = (np.array(self.TRUCK_TYPES)        == row.truck_type).astype(float)
            weather_ohe = (np.array(self.WEATHER_CONDITIONS) == row.weather_condition).astype(float)
            traffic_ohe = (np.array(self.TRAFFIC_CONDITIONS) == row.traffic_condition).astype(float)
            time_ohe    = (np.array(self.TIME_OF_DAY_VALUES) == row.time_of_day).astype(float)
            rows.append(np.concatenate([num_scaled[i], truck_ohe, weather_ohe, traffic_ohe, time_ohe]))
        return np.array(rows)

    # ── Training data ────────────────────────────────────────────────────────

    def _generate_synthetic_data(self, n_samples: int = 20_000) -> pd.DataFrame:
        """
        Simulate actual vs expected delivery hours, then derive binary delay label.
        delay = 1 if actual_hours > expected_hours * 1.15

        Expected plan time derived from route speed + payload profile.
        Disturbance multipliers then generate realistic actual travel time.
        """
        rng = np.random.default_rng(42)

        distance_km = rng.uniform(50, 2_000, n_samples)
        weight_kg   = rng.uniform(500, 30_000, n_samples)

        truck_type  = rng.choice(self.TRUCK_TYPES, n_samples)
        weather     = rng.choice(self.WEATHER_CONDITIONS, n_samples, p=[0.40, 0.20, 0.15, 0.05, 0.10, 0.10])
        traffic     = rng.choice(self.TRAFFIC_CONDITIONS, n_samples, p=[0.20, 0.40, 0.30, 0.10])
        time_of_day = rng.choice(self.TIME_OF_DAY_VALUES, n_samples, p=[0.25, 0.30, 0.25, 0.20])

        # Disturbance multipliers (milder base so normal conditions are not over-penalized).
        weather_mult = {"CLEAR": 0.98, "CLOUDY": 1.00, "RAIN": 1.08, "STORM": 1.22, "FOG": 1.15, "SNOW": 1.20}
        traffic_mult = {"LIGHT": 0.96, "MODERATE": 1.03, "HEAVY": 1.16, "SEVERE": 1.30}
        time_mult    = {"MORNING": 1.05, "AFTERNOON": 1.00, "EVENING": 1.08, "NIGHT": 0.97}

        # Planned ETA baseline includes route speed and payload effects.
        truck_speed_kmh = {"SMALL_VAN": 56.0, "CONTAINER_20FT": 52.0, "CONTAINER_32FT": 48.0, "FLATBED_TRAILER": 46.0, "REEFER": 45.0}
        load_factor = 1.0 + (weight_kg / 60_000) * 0.08
        expected_hours = np.array([
            (distance_km[i] / truck_speed_kmh[truck_type[i]]) * load_factor[i]
            for i in range(n_samples)
        ])

        actual_hours = np.array([
            expected_hours[i]
            * weather_mult[weather[i]]
            * traffic_mult[traffic[i]]
            * time_mult[time_of_day[i]]
            * rng.normal(1.0, 0.05)
            for i in range(n_samples)
        ])

        delay = (actual_hours > expected_hours * 1.15).astype(int)
        delay_rate = delay.mean() * 100
        logger.info("Synthetic training data: %d samples, %.1f%% labelled delayed", n_samples, delay_rate)

        return pd.DataFrame({
            "distance_km":       distance_km,
            "weight_kg":         weight_kg,
            "truck_type":        truck_type,
            "weather_condition": weather,
            "traffic_condition": traffic,
            "time_of_day":       time_of_day,
            "delay":             delay,
        })

    def _load_real_data(self) -> pd.DataFrame | None:
        """Load DataCo supply chain dataset and use late_delivery_risk as binary label."""
        data_path = "data/DataCoSupplyChainDataset.csv"
        if not os.path.exists(data_path):
            return None
        try:
            df = pd.read_csv(data_path, encoding="latin-1")
            rng = np.random.default_rng(42)
            rows = []
        for _, row in df.iterrows():
                distance_km = float(row.get("Distance", rng.uniform(50, 2_000)))
                weight_kg   = float(row.get("Product Weight", rng.uniform(500, 30_000)))
                mode        = str(row.get("Shipping Mode", "Standard"))
                delay       = int(row.get("Late delivery risk", 0))

                if "Same Day"     in mode: traffic = "HEAVY"
                elif "First Class" in mode: traffic = "LIGHT"
                elif "Second Class" in mode: traffic = "MODERATE"
                else: traffic = str(rng.choice(self.TRAFFIC_CONDITIONS, p=[0.2, 0.4, 0.3, 0.1]))

                weather     = str(rng.choice(self.WEATHER_CONDITIONS, p=[0.4, 0.2, 0.15, 0.05, 0.1, 0.1]))
                time_of_day = str(rng.choice(self.TIME_OF_DAY_VALUES))
                truck_type  = str(rng.choice(self.TRUCK_TYPES))

                rows.append({
                    "distance_km":       distance_km,
                    "weight_kg":         weight_kg,
                    "truck_type":        truck_type,
                    "weather_condition": weather,
                    "traffic_condition": traffic,
                    "time_of_day":       time_of_day,
                    "delay":             delay,
                })
            result = pd.DataFrame(rows)
            logger.info("DataCo dataset: %d rows, %.1f%% delayed", len(result), result["delay"].mean() * 100)
            return result
        except Exception as exc:
            logger.warning("Could not load DataCo dataset: %s", exc)
            return None

    # ── Training ─────────────────────────────────────────────────────────────

    def _train(self):
        from sklearn.preprocessing import StandardScaler

            df = self._load_real_data()
        if df is None:
            df = self._generate_synthetic_data(20_000)

        # Fit scaler only on numeric columns
        self.scaler = StandardScaler()
        self.scaler.fit(df[["distance_km", "weight_kg"]].values)

        X = self._build_X_batch(df)
        y = df["delay"].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # ── Logistic Regression (calibrated for reliable probabilities) ─────
        logger.info("Training Logistic Regression ...")
        lr_base = LogisticRegression(
            max_iter=2_000, C=0.5, solver="lbfgs", class_weight="balanced", random_state=42
        )
        self.lr_model = CalibratedClassifierCV(lr_base, method="isotonic", cv=5)
        self.lr_model.fit(X_train, y_train)

        # Keep a plain LR fitted on full train set for coefficient-based explanations
        lr_plain = LogisticRegression(
            max_iter=2_000, C=0.5, solver="lbfgs", class_weight="balanced", random_state=42
        )
        lr_plain.fit(X_train, y_train)
        self._lr_coef      = lr_plain.coef_[0].tolist()   # (21,) → serialisable
        self._lr_intercept = float(lr_plain.intercept_[0])

        # ── Gradient Boosting ────────────────────────────────────────────────
        logger.info("Training Gradient Boosting ...")
        self.gbm_model = GradientBoostingClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.05,
            subsample=0.8, random_state=42,
        )
        self.gbm_model.fit(X_train, y_train)

        # ── Evaluate ensemble ────────────────────────────────────────────────
        lr_proba  = self.lr_model.predict_proba(X_test)[:, 1]
        gbm_proba = self.gbm_model.predict_proba(X_test)[:, 1]
        ens_proba = lr_proba * 0.4 + gbm_proba * 0.6

        self.accuracy    = float(accuracy_score(y_test, (ens_proba >= 0.5).astype(int)))
        self.roc_auc     = float(roc_auc_score(y_test, ens_proba))
        self.brier_score = float(brier_score_loss(y_test, ens_proba))
        self.is_trained  = True
        self.training_date = datetime.now().isoformat()

        logger.info(
            "LR AUC: %.4f | GBM AUC: %.4f | Ensemble AUC: %.4f | Brier: %.4f",
            roc_auc_score(y_test, lr_proba),
            roc_auc_score(y_test, gbm_proba),
            self.roc_auc,
            self.brier_score,
        )

    # ── Persistence ──────────────────────────────────────────────────────────

    def _load_pretrained(self) -> bool:
        if not ModelPersistence.model_exists(_MODEL_NAME):
            return False
        try:
            data, metadata = ModelPersistence.load_model(_MODEL_NAME)
            if not isinstance(data, dict) or "lr_model" not in data:
                return False
            self.scaler        = data["scaler"]
            self.lr_model      = data["lr_model"]
            self.gbm_model     = data["gbm_model"]
            self._lr_coef      = data["lr_coef"]
            self._lr_intercept = data.get("lr_intercept", 0.0)
            self.accuracy      = data.get("accuracy", 0.0)
            self.roc_auc       = data.get("roc_auc", 0.0)
            self.brier_score   = data.get("brier_score", 1.0)
            self.training_date = metadata.get("training_date")
            self.is_trained    = True
            return True
        except Exception as exc:
            logger.warning("Failed to load pre-trained delay model: %s", exc)
            return False

    def _save(self):
        try:
            ModelPersistence.save_model(
                {
                    "scaler":        self.scaler,
                    "lr_model":      self.lr_model,
                    "gbm_model":     self.gbm_model,
                    "lr_coef":       self._lr_coef,
                    "lr_intercept":  self._lr_intercept,
                    "accuracy":      self.accuracy,
                    "roc_auc":       self.roc_auc,
                    "brier_score":   self.brier_score,
                },
                _MODEL_NAME,
                {
                    "model_type":    "Binary LR + GBM Ensemble",
                    "training_date": self.training_date,
                    "roc_auc":       self.roc_auc,
                    "brier_score":   self.brier_score,
                },
            )
        except Exception as exc:
            logger.warning("Failed to save delay model: %s", exc)

    # ── Prediction ────────────────────────────────────────────────────────────

    def predict(
        self,
        distance_km: float,
        weight_kg: float,
        truck_type: str,
        weather_condition: str,
        traffic_condition: str,
        time_of_day: str,
    ) -> Dict:
        if not self.is_trained:
            raise RuntimeError("Delay predictor not trained")

        # Sanitise: unknown values fall back to safe defaults so the model
        # never crashes on bad inputs (and validator also guards this).
        truck_type        = truck_type        if truck_type        in self.TRUCK_TYPES        else "CONTAINER_20FT"
        weather_condition = weather_condition if weather_condition in self.WEATHER_CONDITIONS else "CLEAR"
        traffic_condition = traffic_condition if traffic_condition in self.TRAFFIC_CONDITIONS else "MODERATE"
        time_of_day       = time_of_day       if time_of_day       in self.TIME_OF_DAY_VALUES else "AFTERNOON"

        X = self._build_X_row(distance_km, weight_kg, truck_type, weather_condition, traffic_condition, time_of_day)

        lr_proba  = float(self.lr_model.predict_proba(X)[0, 1])
        gbm_proba = float(self.gbm_model.predict_proba(X)[0, 1])
        ensemble_proba = lr_proba * 0.4 + gbm_proba * 0.6

        # True delay probability (0–100)
        delay_probability = round(ensemble_proba * 100, 2)

        # Risk classification
        if delay_probability <= 25:
            risk_level = "LOW"
        elif delay_probability <= 50:
            risk_level = "MODERATE"
        elif delay_probability <= 75:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        # ── Feature contributions (LR coefficient × feature value) ──────────
        # Each coef_i * X_i is the additive contribution to log-odds.
        # We normalise these to show each group's share of the total delay signal.
        coef       = np.array(self._lr_coef)        # (21,)
        x_row      = X[0]                            # (21,)
        log_odds   = coef * x_row                    # element-wise

        # Positive terms drive delay risk; negative terms reduce it.
        total_positive_signal = max(float(np.sum(np.abs(log_odds))), 1e-8)

        feature_contributions: Dict[str, float] = {}
        for group_name, indices in self._FEATURE_GROUPS.items():
            group_log_odds = float(np.sum(log_odds[indices]))
            # Convert to % of overall delay probability (floored at 0 for UI clarity)
            pct = (group_log_odds / total_positive_signal) * delay_probability
            feature_contributions[group_name] = round(max(0.0, pct), 1)

        # ── Plain-language recommendation ────────────────────────────────────
        recommendations = _build_recommendation(
            risk_level, weather_condition, traffic_condition, time_of_day
        )
        
        return {
            "delay_probability":     delay_probability,
            "risk_level":            risk_level,
            "confidence":            round(max(lr_proba, gbm_proba), 3),
            "feature_contributions": feature_contributions,
            "recommendations":       recommendations,
            "model_details": {
                "lr_probability":  round(lr_proba * 100, 2),
                "gbm_probability": round(gbm_proba * 100, 2),
                "model_type":      "Binary LR + GBM Ensemble",
                "roc_auc":         round(self.roc_auc, 4),
                "brier_score":     round(self.brier_score, 4),
                "accuracy":        round(self.accuracy, 4),
            },
        }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_recommendation(
    risk_level: str,
    weather: str,
    traffic: str,
    time_of_day: str,
) -> str:
    parts = []

    if weather in ("STORM", "SNOW", "FOG"):
        parts.append("consider delaying departure until weather improves")
    if traffic in ("HEAVY", "SEVERE"):
        parts.append("use an alternate route or reschedule to off-peak hours")
    if time_of_day == "MORNING":
        parts.append("morning rush hour increases risk — an afternoon departure may be safer")
    if time_of_day == "EVENING":
        parts.append("evening traffic can add delays — consider night dispatch")

    if risk_level == "LOW":
        return "Conditions look good. Proceed as planned."
    if risk_level == "MODERATE":
        base = "Monitor the shipment closely."
        return f"{base} " + ("; ".join(parts).capitalize() + "." if parts else "")
    if risk_level == "HIGH":
        base = "High delay risk detected."
        return f"{base} " + ("; ".join(parts).capitalize() + "." if parts else "Review route and timing.")
    # CRITICAL
    base = "Critical risk - intervention recommended."
    return f"{base} " + ("; ".join(parts).capitalize() + "." if parts else "Consider postponing or re-routing.")
