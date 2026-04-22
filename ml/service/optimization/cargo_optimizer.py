from ortools.linear_solver import pywraplp
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class CargoOptimizer:
    """
    Optimizes cargo loading using bin packing algorithms.
    Uses Google OR-Tools for optimization.
    """
    
    def __init__(self):
        logger.info("CargoOptimizer initialized")
    
    def optimize(self, truck_capacity_kg: float, truck_capacity_m3: float, 
                 items: List[Dict]) -> Dict:
        """
        Optimize cargo loading to maximize truck utilization.
        
        Args:
            truck_capacity_kg: Maximum weight capacity
            truck_capacity_m3: Maximum volume capacity
            items: List of items with weight, volume, priority
        
        Returns:
            Optimization results with selected items and utilization
        """
        if not items:
            logger.warning("No items provided for optimization")
            return {
                'selected_items': [],
                'total_weight_kg': 0,
                'total_volume_m3': 0,
                'utilization_percent': 0,
                'items_loaded': 0,
                'items_rejected': 0
            }
        
        solver = pywraplp.Solver.CreateSolver('SCIP')
        if not solver:
            logger.error("SCIP solver not available")
            return self._fallback_greedy_optimization(
                truck_capacity_kg, truck_capacity_m3, items
            )
        
        num_items = len(items)
        x = [solver.BoolVar(f'x_{i}') for i in range(num_items)]
        
        weight_constraint = solver.Constraint(0, truck_capacity_kg)
        for i in range(num_items):
            weight = items[i].get('weight_kg', 0)
            weight_constraint.SetCoefficient(x[i], weight)
        
        volume_constraint = solver.Constraint(0, truck_capacity_m3)
        for i in range(num_items):
            volume = items[i].get('volume_m3', 0)
            volume_constraint.SetCoefficient(x[i], volume)
        
        objective = solver.Objective()
        for i in range(num_items):
            priority = items[i].get('priority', 1)
            weight = items[i].get('weight_kg', 0)
            value = weight * priority
            objective.SetCoefficient(x[i], value)
        objective.SetMaximization()
        
        status = solver.Solve()
        
        if status == pywraplp.Solver.OPTIMAL or status == pywraplp.Solver.FEASIBLE:
            selected_items = []
            total_weight = 0
            total_volume = 0
            
            for i in range(num_items):
                if x[i].solution_value() > 0.5:
                    item = items[i].copy()
                    selected_items.append(item)
                    total_weight += item.get('weight_kg', 0)
                    total_volume += item.get('volume_m3', 0)
            
            weight_util = (total_weight / truck_capacity_kg) * 100
            volume_util = (total_volume / truck_capacity_m3) * 100
            avg_util = (weight_util + volume_util) / 2
            
            return {
                'selected_items': selected_items,
                'total_weight_kg': round(total_weight, 2),
                'total_volume_m3': round(total_volume, 2),
                'utilization_percent': round(avg_util, 2),
                'weight_utilization': round(weight_util, 2),
                'volume_utilization': round(volume_util, 2),
                'items_loaded': len(selected_items),
                'items_rejected': num_items - len(selected_items),
                'optimization_status': 'OPTIMAL' if status == pywraplp.Solver.OPTIMAL else 'FEASIBLE',
                'remaining_capacity': {
                    'weight_kg': round(truck_capacity_kg - total_weight, 2),
                    'volume_m3': round(truck_capacity_m3 - total_volume, 2)
                }
            }
        else:
            logger.warning("Optimization failed, using greedy fallback")
            return self._fallback_greedy_optimization(
                truck_capacity_kg, truck_capacity_m3, items
            )
    
    def _fallback_greedy_optimization(self, capacity_kg: float, capacity_m3: float,
                                       items: List[Dict]) -> Dict:
        """Greedy fallback when solver fails."""
        sorted_items = sorted(
            items,
            key=lambda x: x.get('priority', 1) * x.get('weight_kg', 0),
            reverse=True
        )
        
        selected = []
        total_weight = 0
        total_volume = 0
        
        for item in sorted_items:
            weight = item.get('weight_kg', 0)
            volume = item.get('volume_m3', 0)
            
            if (total_weight + weight <= capacity_kg and 
                total_volume + volume <= capacity_m3):
                selected.append(item)
                total_weight += weight
                total_volume += volume
        
        weight_util = (total_weight / capacity_kg) * 100
        volume_util = (total_volume / capacity_m3) * 100
        avg_util = (weight_util + volume_util) / 2
        
        return {
            'selected_items': selected,
            'total_weight_kg': round(total_weight, 2),
            'total_volume_m3': round(total_volume, 2),
            'utilization_percent': round(avg_util, 2),
            'weight_utilization': round(weight_util, 2),
            'volume_utilization': round(volume_util, 2),
            'items_loaded': len(selected),
            'items_rejected': len(items) - len(selected),
            'optimization_status': 'GREEDY_FALLBACK',
            'remaining_capacity': {
                'weight_kg': round(capacity_kg - total_weight, 2),
                'volume_m3': round(capacity_m3 - total_volume, 2)
            }
        }
