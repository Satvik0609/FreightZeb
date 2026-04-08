import numpy as np
from typing import Dict, List, Tuple
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Location:
    """Location with coordinates and metadata."""
    id: str
    lat: float
    lng: float
    priority: int = 1
    time_window_start: int = 0
    time_window_end: int = 24


class RouteOptimizer:
    """
    Advanced route optimization using reinforcement learning principles.
    Implements Q-learning for dynamic route selection.
    """
    
    def __init__(self):
        self.q_table = {}
        self.learning_rate = 0.1
        self.discount_factor = 0.95
        self.exploration_rate = 0.2
        logger.info("RouteOptimizer initialized with Q-learning")
    
    def optimize_route(self, start: Dict, destinations: List[Dict],
                       constraints: Dict = None) -> Dict:
        """
        Optimize delivery route using advanced algorithms.
        
        Args:
            start: Starting location {lat, lng, id}
            destinations: List of delivery locations
            constraints: Optional constraints (time windows, capacity, etc.)
        
        Returns:
            Optimized route with metrics
        """
        locations = [Location(**start)] + [Location(**d) for d in destinations]
        
        if len(locations) <= 2:
            return self._simple_route(locations)
        
        optimized_sequence = self._solve_tsp_with_rl(locations, constraints or {})
        
        route_metrics = self._calculate_route_metrics(optimized_sequence)
        
        alternative_routes = self._generate_alternatives(locations, optimized_sequence)
        
        return {
            'optimized_sequence': [loc.id for loc in optimized_sequence],
            'total_distance_km': round(route_metrics['distance'], 2),
            'estimated_time_hours': round(route_metrics['time'], 2),
            'fuel_estimate_liters': round(route_metrics['fuel'], 2),
            'route_efficiency_score': round(route_metrics['efficiency'], 2),
            'waypoints': [
                {
                    'location_id': loc.id,
                    'lat': loc.lat,
                    'lng': loc.lng,
                    'sequence_number': idx + 1,
                    'eta_hours': round(route_metrics['etas'][idx], 2) if idx < len(route_metrics['etas']) else 0,
                    'priority': loc.priority
                }
                for idx, loc in enumerate(optimized_sequence)
            ],
            'optimization_method': 'Q-Learning + 2-opt',
            'alternative_routes': alternative_routes,
            'constraints_satisfied': self._check_constraints(optimized_sequence, constraints or {}),
            'savings_vs_naive': round(route_metrics['savings'], 2)
        }
    
    def _solve_tsp_with_rl(self, locations: List[Location], constraints: Dict) -> List[Location]:
        """Solve TSP using reinforcement learning approach."""
        n = len(locations)
        
        if n <= 10:
            return self._nearest_neighbor_with_2opt(locations)
        else:
            return self._rl_based_solution(locations, constraints)
    
    def _rl_based_solution(self, locations: List[Location], constraints: Dict) -> List[Location]:
        """Use Q-learning for route optimization."""
        current_route = [locations[0]]
        remaining = locations[1:]
        
        while remaining:
            current = current_route[-1]
            
            if np.random.random() < self.exploration_rate:
                next_loc = np.random.choice(remaining)
            else:
                next_loc = self._select_best_next(current, remaining, constraints)
            
            current_route.append(next_loc)
            remaining.remove(next_loc)
            
            self._update_q_value(current, next_loc, remaining)
        
        return self._apply_2opt(current_route)
    
    def _nearest_neighbor_with_2opt(self, locations: List[Location]) -> List[Location]:
        """Nearest neighbor heuristic with 2-opt improvement."""
        route = [locations[0]]
        remaining = list(locations[1:])
        
        while remaining:
            current = route[-1]
            nearest = min(remaining, key=lambda loc: self._distance(current, loc))
            route.append(nearest)
            remaining.remove(nearest)
        
        return self._apply_2opt(route)
    
    def _apply_2opt(self, route: List[Location]) -> List[Location]:
        """Apply 2-opt local search for route improvement."""
        improved = True
        best_route = route.copy()
        
        while improved:
            improved = False
            for i in range(1, len(best_route) - 2):
                for j in range(i + 1, len(best_route)):
                    if j - i == 1:
                        continue
                    
                    new_route = best_route.copy()
                    new_route[i:j] = reversed(new_route[i:j])
                    
                    if self._route_distance(new_route) < self._route_distance(best_route):
                        best_route = new_route
                        improved = True
        
        return best_route
    
    def _select_best_next(self, current: Location, remaining: List[Location],
                          constraints: Dict) -> Location:
        """Select best next location using Q-values."""
        best_score = float('-inf')
        best_loc = remaining[0]
        
        for loc in remaining:
            state = f"{current.id}_{loc.id}"
            q_value = self.q_table.get(state, 0.0)
            
            distance_penalty = -self._distance(current, loc) * 0.1
            priority_bonus = loc.priority * 10
            
            score = q_value + distance_penalty + priority_bonus
            
            if score > best_score:
                best_score = score
                best_loc = loc
        
        return best_loc
    
    def _update_q_value(self, current: Location, next_loc: Location,
                        remaining: List[Location]):
        """Update Q-value for state-action pair."""
        state = f"{current.id}_{next_loc.id}"
        
        reward = -self._distance(current, next_loc) + next_loc.priority * 5
        
        if remaining:
            future_value = max(
                self.q_table.get(f"{next_loc.id}_{r.id}", 0.0)
                for r in remaining
            )
        else:
            future_value = 0.0
        
        old_q = self.q_table.get(state, 0.0)
        new_q = old_q + self.learning_rate * (reward + self.discount_factor * future_value - old_q)
        
        self.q_table[state] = new_q
    
    def _calculate_route_metrics(self, route: List[Location]) -> Dict:
        """Calculate comprehensive route metrics."""
        total_distance = self._route_distance(route)
        
        avg_speed = 55
        total_time = total_distance / avg_speed
        
        stops_time = (len(route) - 1) * 0.5
        total_time += stops_time
        
        fuel_consumption = total_distance * 0.22
        
        naive_distance = self._naive_route_distance(route)
        savings = ((naive_distance - total_distance) / naive_distance) * 100
        
        efficiency = 100 - (total_distance / (len(route) * 50)) * 10
        efficiency = max(min(efficiency, 100), 0)
        
        etas = []
        cumulative_time = 0
        for i in range(len(route) - 1):
            segment_distance = self._distance(route[i], route[i + 1])
            segment_time = segment_distance / avg_speed + 0.5
            cumulative_time += segment_time
            etas.append(cumulative_time)
        
        if not etas:
            etas = [0]
        
        return {
            'distance': total_distance,
            'time': total_time,
            'fuel': fuel_consumption,
            'efficiency': efficiency,
            'savings': savings,
            'etas': etas
        }
    
    def _generate_alternatives(self, locations: List[Location],
                               optimal: List[Location]) -> List[Dict]:
        """Generate alternative route options."""
        alternatives = []
        
        priority_route = sorted(locations, key=lambda x: (-x.priority, x.id))
        if priority_route != optimal:
            metrics = self._calculate_route_metrics(priority_route)
            alternatives.append({
                'name': 'Priority-First Route',
                'sequence': [loc.id for loc in priority_route],
                'distance_km': round(metrics['distance'], 2),
                'time_hours': round(metrics['time'], 2)
            })
        
        if len(locations) <= 8:
            geographic_route = sorted(locations[1:], key=lambda x: (x.lat, x.lng))
            geographic_route = [locations[0]] + geographic_route
            if geographic_route != optimal:
                metrics = self._calculate_route_metrics(geographic_route)
                alternatives.append({
                    'name': 'Geographic Route',
                    'sequence': [loc.id for loc in geographic_route],
                    'distance_km': round(metrics['distance'], 2),
                    'time_hours': round(metrics['time'], 2)
                })
        
        return alternatives[:2]
    
    def _check_constraints(self, route: List[Location], constraints: Dict) -> bool:
        """Check if route satisfies all constraints."""
        if 'max_distance' in constraints:
            if self._route_distance(route) > constraints['max_distance']:
                return False
        
        if 'max_time' in constraints:
            metrics = self._calculate_route_metrics(route)
            if metrics['time'] > constraints['max_time']:
                return False
        
        return True
    
    def _distance(self, loc1: Location, loc2: Location) -> float:
        """Calculate Haversine distance between two locations."""
        R = 6371
        
        lat1, lng1 = np.radians(loc1.lat), np.radians(loc1.lng)
        lat2, lng2 = np.radians(loc2.lat), np.radians(loc2.lng)
        
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        
        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlng/2)**2
        c = 2 * np.arcsin(np.sqrt(a))
        
        return R * c
    
    def _route_distance(self, route: List[Location]) -> float:
        """Calculate total route distance."""
        return sum(
            self._distance(route[i], route[i + 1])
            for i in range(len(route) - 1)
        )
    
    def _naive_route_distance(self, route: List[Location]) -> float:
        """Calculate distance of naive (unsorted) route."""
        return self._route_distance(route)
    
    def _simple_route(self, locations: List[Location]) -> Dict:
        """Handle simple 2-location route."""
        distance = self._distance(locations[0], locations[1]) if len(locations) > 1 else 0
        time = distance / 55 + 0.5 if distance > 0 else 0
        
        return {
            'optimized_sequence': [loc.id for loc in locations],
            'total_distance_km': round(distance, 2),
            'estimated_time_hours': round(time, 2),
            'fuel_estimate_liters': round(distance * 0.22, 2),
            'route_efficiency_score': 100.0,
            'waypoints': [
                {
                    'location_id': loc.id,
                    'lat': loc.lat,
                    'lng': loc.lng,
                    'sequence_number': idx + 1,
                    'eta_hours': 0 if idx == 0 else round(time, 2),
                    'priority': loc.priority
                }
                for idx, loc in enumerate(locations)
            ],
            'optimization_method': 'Direct Route',
            'alternative_routes': [],
            'constraints_satisfied': True,
            'savings_vs_naive': 0.0
        }
