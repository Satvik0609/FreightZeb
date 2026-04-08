import numpy as np
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class TruckRecommender:
    """
    Recommends optimal truck type based on shipment characteristics.
    Uses rule-based logic with ML-ready architecture.
    """
    
    def __init__(self):
        self.truck_specs = {
            'SMALL_VAN': {'max_weight': 1500, 'max_volume': 10, 'cost_per_km': 2.5},
            'CONTAINER_20FT': {'max_weight': 20000, 'max_volume': 33, 'cost_per_km': 5.0},
            'CONTAINER_32FT': {'max_weight': 32000, 'max_volume': 67, 'cost_per_km': 7.5},
            'FLATBED_TRAILER': {'max_weight': 25000, 'max_volume': 50, 'cost_per_km': 6.5},
            'REEFER': {'max_weight': 18000, 'max_volume': 30, 'cost_per_km': 8.0}
        }
        logger.info("TruckRecommender initialized")
    
    def recommend(self, weight_kg: float, volume_m3: float, distance_km: float, 
                  cargo_type: str = "GENERAL", priority: str = "NORMAL") -> Dict:
        """
        Recommend optimal truck based on cargo specifications.
        
        Args:
            weight_kg: Cargo weight in kilograms
            volume_m3: Cargo volume in cubic meters
            distance_km: Travel distance in kilometers
            cargo_type: Type of cargo (GENERAL, PERISHABLE, HAZARDOUS, FRAGILE)
            priority: Shipment priority (LOW, NORMAL, HIGH, URGENT)
        
        Returns:
            Dictionary with recommendation details
        """
        suitable_trucks = []
        
        for truck_type, specs in self.truck_specs.items():
            if cargo_type == "PERISHABLE" and truck_type != "REEFER":
                continue
            
            if weight_kg <= specs['max_weight'] and volume_m3 <= specs['max_volume']:
                weight_util = (weight_kg / specs['max_weight']) * 100
                volume_util = (volume_m3 / specs['max_volume']) * 100
                avg_util = (weight_util + volume_util) / 2
                
                cost = specs['cost_per_km'] * distance_km
                
                priority_multiplier = {
                    'LOW': 1.0,
                    'NORMAL': 1.1,
                    'HIGH': 1.3,
                    'URGENT': 1.5
                }.get(priority, 1.0)
                
                score = (avg_util * 0.6) + ((100 - (cost / 100)) * 0.4)
                score *= priority_multiplier
                
                suitable_trucks.append({
                    'truck_type': truck_type,
                    'score': score,
                    'utilization': avg_util,
                    'estimated_cost': cost,
                    'weight_utilization': weight_util,
                    'volume_utilization': volume_util
                })
        
        if not suitable_trucks:
            logger.warning(f"No suitable truck found for weight={weight_kg}kg, volume={volume_m3}m3")
            return {
                'recommended_truck': 'CONTAINER_32FT',
                'confidence': 0.5,
                'score': 50.0,
                'alternatives': [],
                'reason': 'Default recommendation - cargo exceeds standard capacities'
            }
        
        suitable_trucks.sort(key=lambda x: x['score'], reverse=True)
        best_truck = suitable_trucks[0]
        
        confidence = min(best_truck['score'] / 100, 0.99)
        
        return {
            'recommended_truck': best_truck['truck_type'],
            'confidence': round(confidence, 3),
            'score': round(best_truck['score'], 2),
            'utilization_percent': round(best_truck['utilization'], 2),
            'estimated_cost': round(best_truck['estimated_cost'], 2),
            'weight_utilization': round(best_truck['weight_utilization'], 2),
            'volume_utilization': round(best_truck['volume_utilization'], 2),
            'alternatives': [
                {
                    'truck_type': t['truck_type'],
                    'score': round(t['score'], 2),
                    'utilization': round(t['utilization'], 2)
                }
                for t in suitable_trucks[1:3]
            ]
        }
