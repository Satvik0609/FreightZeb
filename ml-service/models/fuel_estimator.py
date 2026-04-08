import numpy as np
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class FuelEstimator:
    """
    Estimates fuel consumption for shipments.
    Based on truck type, distance, and load weight.
    """
    
    def __init__(self):
        self.base_consumption_per_100km = {
            'SMALL_VAN': 8.5,
            'CONTAINER_20FT': 22.0,
            'CONTAINER_32FT': 28.0,
            'FLATBED_TRAILER': 25.0,
            'REEFER': 30.0
        }
        
        self.max_capacity_kg = {
            'SMALL_VAN': 1500,
            'CONTAINER_20FT': 20000,
            'CONTAINER_32FT': 32000,
            'FLATBED_TRAILER': 25000,
            'REEFER': 18000
        }
        
        logger.info("FuelEstimator initialized")
    
    def estimate(self, distance_km: float, weight_kg: float, truck_type: str) -> Dict:
        """
        Estimate fuel consumption for a shipment.
        
        Args:
            distance_km: Travel distance
            weight_kg: Cargo weight
            truck_type: Type of truck
        
        Returns:
            Fuel estimation with cost breakdown
        """
        base_consumption = self.base_consumption_per_100km.get(truck_type, 25.0)
        max_capacity = self.max_capacity_kg.get(truck_type, 25000)
        
        load_factor = weight_kg / max_capacity
        load_factor = min(load_factor, 1.0)
        
        load_multiplier = 1.0 + (load_factor * 0.25)
        
        consumption_per_100km = base_consumption * load_multiplier
        
        total_liters = (distance_km / 100) * consumption_per_100km
        
        fuel_price_per_liter = 1.45
        total_cost = total_liters * fuel_price_per_liter
        
        co2_kg = total_liters * 2.68
        
        efficiency_rating = self._calculate_efficiency_rating(
            consumption_per_100km, truck_type
        )
        
        return {
            'estimated_liters': round(total_liters, 2),
            'estimated_cost': round(total_cost, 2),
            'consumption_per_100km': round(consumption_per_100km, 2),
            'co2_emissions_kg': round(co2_kg, 2),
            'efficiency_rating': efficiency_rating,
            'load_factor': round(load_factor, 3),
            'fuel_price_per_liter': fuel_price_per_liter,
            'breakdown': {
                'base_consumption': base_consumption,
                'load_multiplier': round(load_multiplier, 3),
                'distance_km': distance_km
            }
        }
    
    def _calculate_efficiency_rating(self, consumption: float, truck_type: str) -> str:
        """Rate fuel efficiency."""
        base = self.base_consumption_per_100km.get(truck_type, 25.0)
        
        if consumption <= base * 1.05:
            return 'EXCELLENT'
        elif consumption <= base * 1.15:
            return 'GOOD'
        elif consumption <= base * 1.25:
            return 'AVERAGE'
        else:
            return 'POOR'
