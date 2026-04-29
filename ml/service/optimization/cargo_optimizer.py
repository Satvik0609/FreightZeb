"""
Production-grade Cargo Optimizer — Multi-dimensional Knapsack.

Optimization method:
  Binary decision variables per item (load = 1 / reject = 0).
  Objective: maximize Σ priority_i * (0.6 * efficiency_i + 0.4)
  Constraints: total weight ≤ truck_capacity_kg, total volume ≤ truck_capacity_m3.
  Solver: OR-Tools SCIP; greedy priority-sorted fallback when solver unavailable.
  Post-processing: hybrid top-up fill for leftover capacity.

Output contract (stable keys):
  selected_items, rejected_items,
  weight_used, volume_used,              <- canonical keys for frontend
  total_weight_kg, total_volume_m3,      <- backward-compat aliases
  weight_utilization, volume_utilization, utilization_percent,
  items_loaded, items_rejected,
  remaining_capacity: {weight_kg, volume_m3},
  optimization_status: OPTIMAL | FEASIBLE | GREEDY_FALLBACK | EMPTY
"""

from ortools.linear_solver import pywraplp
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

_REJECTION_LABELS = {
    "exceeds_truck_weight":      "Over weight limit",
    "exceeds_truck_volume":      "Over volume limit",
    "exceeds_truck_both":        "Over both limits",
    "not_selected_by_optimizer": "Lower priority",
    "capacity_exceeded":         "Capacity full",
    "over_weight":               "Over weight limit",
    "over_volume":               "Over volume limit",
    "over_weight_and_volume":    "Over both limits",
    "lower_objective_priority":  "Lower priority",
}


def _readable_reason(raw: str) -> str:
    return _REJECTION_LABELS.get(raw, raw.replace("_", " ").capitalize())


class CargoOptimizer:
    """
    Advanced Cargo Optimizer using OR-Tools (Multi-dimensional Knapsack).
    Handles weight + volume + priority + efficiency balancing.
    """

    def __init__(self):
        logger.info("CargoOptimizer initialized")

    # ── Public API ────────────────────────────────────────────────────────────

    def optimize(
        self,
        truck_capacity_kg: float,
        truck_capacity_m3: float,
        items: List[Dict],
    ) -> Dict:
        if not items:
            return self._empty_response()

        truck_capacity_kg = float(truck_capacity_kg or 0)
        truck_capacity_m3 = float(truck_capacity_m3 or 0)

        # Sort by priority descending — important for greedy fallback ordering
        # and for consistent item ordering in tables.
        items = sorted(
            items,
            key=lambda x: float(x.get("priority", 1)),
            reverse=True,
        )

        solver = pywraplp.Solver.CreateSolver("SCIP")
        if not solver:
            logger.warning("SCIP not available, using greedy fallback")
            return self._fallback_greedy_optimization(
                truck_capacity_kg, truck_capacity_m3, items
            )

        n = len(items)
        x = [solver.BoolVar(f"x_{i}") for i in range(n)]

        # Constraints
        weight_c = solver.Constraint(0, truck_capacity_kg)
        volume_c = solver.Constraint(0, truck_capacity_m3)
        for i in range(n):
            weight_c.SetCoefficient(x[i], float(items[i].get("weight_kg", 0)))
            volume_c.SetCoefficient(x[i], float(items[i].get("volume_m3", 0)))

        # Objective: priority-weighted efficiency score
        obj = solver.Objective()
        for i in range(n):
            item = items[i]
            weight = float(item.get("weight_kg", 0))
            volume = float(item.get("volume_m3", 0))
            priority = float(item.get("priority", 1))
            weight_norm = weight / truck_capacity_kg if truck_capacity_kg else 0
            volume_norm = volume / truck_capacity_m3 if truck_capacity_m3 else 0
            efficiency = (weight_norm + volume_norm) / 2
            obj.SetCoefficient(x[i], priority * (0.6 * efficiency + 0.4))
        obj.SetMaximization()

        raw_status = solver.Solve()
        if raw_status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
            logger.warning("Solver failed, using greedy fallback")
            return self._fallback_greedy_optimization(
                truck_capacity_kg, truck_capacity_m3, items
            )

        solver_status = (
            "OPTIMAL" if raw_status == pywraplp.Solver.OPTIMAL else "FEASIBLE"
        )

        # Collect initial solver decision
        selected, rejected = [], []
        total_weight, total_volume = 0.0, 0.0

        for i in range(n):
            item = {k: v for k, v in items[i].items() if k != "reason"}
            if x[i].solution_value() > 0.5:
                selected.append(item)
                total_weight += float(item.get("weight_kg", 0))
                total_volume += float(item.get("volume_m3", 0))
            else:
                w = float(item.get("weight_kg", 0))
                v = float(item.get("volume_m3", 0))
                if w > truck_capacity_kg and v > truck_capacity_m3:
                    reason = "exceeds_truck_both"
                elif w > truck_capacity_kg:
                    reason = "exceeds_truck_weight"
                elif v > truck_capacity_m3:
                    reason = "exceeds_truck_volume"
                else:
                    reason = "not_selected_by_optimizer"
                item["reason"] = reason
                item["reason_label"] = _readable_reason(reason)
                rejected.append(item)

        # Hybrid top-up fill: try to load any rejected item into leftover space.
        remaining_w = truck_capacity_kg - total_weight
        remaining_v = truck_capacity_m3 - total_volume

        still_rejected = []
        for item in rejected:
            w = float(item.get("weight_kg", 0))
            v = float(item.get("volume_m3", 0))
            if w <= remaining_w and v <= remaining_v:
                clean_item = {k: v2 for k, v2 in item.items()
                              if k not in ("reason", "reason_label")}
                selected.append(clean_item)
                remaining_w -= w
                remaining_v -= v
                total_weight += w
                total_volume += v
            else:
                still_rejected.append(item)

        return self._build_response(
            selected, still_rejected,
            total_weight, total_volume,
            truck_capacity_kg, truck_capacity_m3,
            solver_status,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _build_response(
        self,
        selected: List[Dict],
        rejected: List[Dict],
        total_weight: float,
        total_volume: float,
        cap_kg: float,
        cap_m3: float,
        status: str,
    ) -> Dict:
        weight_util = (total_weight / cap_kg * 100) if cap_kg else 0
        volume_util = (total_volume / cap_m3 * 100) if cap_m3 else 0
        avg_util = (weight_util + volume_util) / 2

        return {
            "selected_items": selected,
            "rejected_items": rejected,
            # Canonical keys (frontend reads these first)
            "weight_used": round(total_weight, 2),
            "volume_used": round(total_volume, 2),
            # Backward-compat aliases
            "total_weight_kg": round(total_weight, 2),
            "total_volume_m3": round(total_volume, 2),
            "weight_utilization": round(weight_util, 2),
            "volume_utilization": round(volume_util, 2),
            "utilization_percent": round(avg_util, 2),
            "items_loaded": len(selected),
            "items_rejected": len(rejected),
            "remaining_capacity": {
                "weight_kg": round(cap_kg - total_weight, 2),
                "volume_m3": round(cap_m3 - total_volume, 2),
            },
            "optimization_status": status,
        }

    def _empty_response(self) -> Dict:
        return {
            "selected_items": [],
            "rejected_items": [],
            "weight_used": 0,
            "volume_used": 0,
            "total_weight_kg": 0,
            "total_volume_m3": 0,
            "weight_utilization": 0,
            "volume_utilization": 0,
            "utilization_percent": 0,
            "items_loaded": 0,
            "items_rejected": 0,
            "remaining_capacity": {"weight_kg": 0, "volume_m3": 0},
            "optimization_status": "EMPTY",
        }

    def _fallback_greedy_optimization(
        self, cap_kg: float, cap_m3: float, items: List[Dict]
    ) -> Dict:
        """Priority-sorted greedy fallback when the SCIP solver is unavailable."""
        # items already sorted by priority from caller
        selected, rejected = [], []
        total_weight, total_volume = 0.0, 0.0

        for item in items:
            w = float(item.get("weight_kg", 0))
            v = float(item.get("volume_m3", 0))
            clean = {k: val for k, val in item.items() if k not in ("reason", "reason_label")}
            if total_weight + w <= cap_kg and total_volume + v <= cap_m3:
                selected.append(clean)
                total_weight += w
                total_volume += v
            else:
                reason = "capacity_exceeded"
                clean["reason"] = reason
                clean["reason_label"] = _readable_reason(reason)
                rejected.append(clean)

        return self._build_response(
            selected, rejected,
            total_weight, total_volume,
            cap_kg, cap_m3,
            "GREEDY_FALLBACK",
        )
