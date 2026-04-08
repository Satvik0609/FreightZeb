# FreightZen API Testing Guide

Complete guide for testing all API endpoints using curl, Postman, or any HTTP client.

## Base URLs

- Backend API: `http://localhost:5000`
- ML Service: `http://localhost:8000`
- Frontend: `http://localhost:3000`

## Authentication

Most endpoints require JWT token. Include in headers:
```
Authorization: Bearer <your-token>
```

## 1. Authentication Endpoints

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User",
    "role": "CUSTOMER"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "name": "Test User",
    "role": "CUSTOMER"
  }
}
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

## 2. Shipment Endpoints

### Create Shipment
```bash
curl -X POST http://localhost:5000/api/shipments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "origin": {
      "address": "New York, NY",
      "lat": 40.7128,
      "lng": -74.0060,
      "city": "New York"
    },
    "destination": {
      "address": "Los Angeles, CA",
      "lat": 34.0522,
      "lng": -118.2437,
      "city": "Los Angeles"
    },
    "weightKg": 5000,
    "volumeM3": 15,
    "description": "Electronics shipment"
  }'
```

### Get All Shipments
```bash
curl -X GET http://localhost:5000/api/shipments \
  -H "Authorization: Bearer <token>"
```

### Get Single Shipment
```bash
curl -X GET http://localhost:5000/api/shipments/<shipment-id> \
  -H "Authorization: Bearer <token>"
```

## 3. Truck Endpoints

### Create Truck
```bash
curl -X POST http://localhost:5000/api/trucks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "registrationNo": "TRK-100",
    "type": "CONTAINER_20FT",
    "capacityKg": 20000,
    "capacityM3": 33
  }'
```

### Get All Trucks
```bash
curl -X GET http://localhost:5000/api/trucks \
  -H "Authorization: Bearer <token>"
```

### Get Trucks by Status
```bash
curl -X GET "http://localhost:5000/api/trucks?status=AVAILABLE" \
  -H "Authorization: Bearer <token>"
```

### Update Truck
```bash
curl -X PUT http://localhost:5000/api/trucks/<truck-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "status": "IN_TRANSIT"
  }'
```

### Delete Truck
```bash
curl -X DELETE http://localhost:5000/api/trucks/<truck-id> \
  -H "Authorization: Bearer <token>"
```

## 4. ML Service Endpoints

### Truck Recommendation
```bash
curl -X GET "http://localhost:5000/api/ml/recommend-truck?weight_kg=5000&volume_m3=15&distance_km=500&cargo_type=GENERAL&priority=NORMAL" \
  -H "Authorization: Bearer <token>"
```

**Direct ML Service:**
```bash
curl -X POST http://localhost:8000/predict-truck \
  -H "Content-Type: application/json" \
  -d '{
    "weight_kg": 5000,
    "volume_m3": 15,
    "distance_km": 500,
    "cargo_type": "GENERAL",
    "priority": "NORMAL"
  }'
```

### Delivery Time Prediction
```bash
curl -X GET http://localhost:5000/api/ml/predict-delivery/<shipment-id> \
  -H "Authorization: Bearer <token>"
```

**Direct ML Service:**
```bash
curl -X POST http://localhost:8000/predict-delivery-time \
  -H "Content-Type: application/json" \
  -d '{
    "weight_kg": 5000,
    "distance_km": 500,
    "truck_type": "CONTAINER_20FT",
    "traffic_condition": "MODERATE",
    "weather_condition": "CLEAR"
  }'
```

### Cluster Shipments
```bash
curl -X GET http://localhost:5000/api/ml/cluster-shipments \
  -H "Authorization: Bearer <token>"
```

**Direct ML Service:**
```bash
curl -X POST http://localhost:8000/cluster-shipments \
  -H "Content-Type: application/json" \
  -d '{
    "shipments": [
      {
        "id": "1",
        "destination": {"lat": 40.7128, "lng": -74.0060},
        "weight_kg": 5000,
        "volume_m3": 15
      },
      {
        "id": "2",
        "destination": {"lat": 40.7580, "lng": -73.9855},
        "weight_kg": 3000,
        "volume_m3": 10
      }
    ]
  }'
```

### Delay Risk Prediction
```bash
curl -X GET "http://localhost:5000/api/ml/predict-delay/<shipment-id>?weather=RAIN&traffic=HEAVY&time_of_day=MORNING" \
  -H "Authorization: Bearer <token>"
```

**Direct ML Service:**
```bash
curl -X POST http://localhost:8000/predict-delay-risk \
  -H "Content-Type: application/json" \
  -d '{
    "distance_km": 500,
    "weight_kg": 5000,
    "truck_type": "CONTAINER_20FT",
    "weather_condition": "RAIN",
    "traffic_condition": "HEAVY",
    "time_of_day": "MORNING"
  }'
```

### Fuel Estimation
```bash
curl -X GET "http://localhost:5000/api/ml/estimate-fuel?distance_km=500&weight_kg=5000&truck_type=CONTAINER_20FT" \
  -H "Authorization: Bearer <token>"
```

**Direct ML Service:**
```bash
curl -X POST http://localhost:8000/estimate-fuel \
  -H "Content-Type: application/json" \
  -d '{
    "distance_km": 500,
    "weight_kg": 5000,
    "truck_type": "CONTAINER_20FT"
  }'
```

### Cargo Optimization
```bash
curl -X POST http://localhost:5000/api/ml/optimize-cargo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "truck_capacity_kg": 20000,
    "truck_capacity_m3": 33,
    "items": [
      {"id": "item1", "weight_kg": 500, "volume_m3": 2, "priority": 2},
      {"id": "item2", "weight_kg": 800, "volume_m3": 3, "priority": 1},
      {"id": "item3", "weight_kg": 1200, "volume_m3": 4, "priority": 3}
    ]
  }'
```

## 5. Analytics Endpoints

### Get Analytics Overview
```bash
curl -X GET http://localhost:5000/api/analytics \
  -H "Authorization: Bearer <token>"
```

### Get Shipment Trends
```bash
curl -X GET "http://localhost:5000/api/analytics/trends?days=30" \
  -H "Authorization: Bearer <token>"
```

## 6. Health Check Endpoints

### Backend Health
```bash
curl -X GET http://localhost:5000/api/auth/login
```

### ML Service Health
```bash
curl -X GET http://localhost:8000/health
```

**Response:**
```json
{
  "status": "healthy",
  "models_loaded": true
}
```

### ML Service Root
```bash
curl -X GET http://localhost:8000/
```

**Response:**
```json
{
  "service": "FreightZen ML Service",
  "version": "1.0.0",
  "status": "operational"
}
```

## Testing Workflow

### 1. Complete User Journey
```bash
# 1. Register
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test"}' \
  | jq -r '.token')

# 2. Create Truck
curl -X POST http://localhost:5000/api/trucks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"registrationNo":"TRK-TEST","type":"CONTAINER_20FT","capacityKg":20000,"capacityM3":33}'

# 3. Create Shipment
SHIPMENT_ID=$(curl -s -X POST http://localhost:5000/api/shipments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"origin":{"address":"NYC","lat":40.7128,"lng":-74.0060},"destination":{"address":"LA","lat":34.0522,"lng":-118.2437},"weightKg":5000,"volumeM3":15}' \
  | jq -r '.id')

# 4. Get Truck Recommendation
curl -X GET "http://localhost:5000/api/ml/recommend-truck?weight_kg=5000&volume_m3=15&distance_km=500" \
  -H "Authorization: Bearer $TOKEN"

# 5. Predict Delivery Time
curl -X GET "http://localhost:5000/api/ml/predict-delivery/$SHIPMENT_ID" \
  -H "Authorization: Bearer $TOKEN"

# 6. View Analytics
curl -X GET http://localhost:5000/api/analytics \
  -H "Authorization: Bearer $TOKEN"
```

## Postman Collection

### Import into Postman

1. Create new collection "FreightZen API"
2. Add environment variables:
   - `base_url`: http://localhost:5000
   - `ml_url`: http://localhost:8000
   - `token`: (will be set after login)

3. Add requests from above examples
4. Use `{{base_url}}` and `{{token}}` variables

### Pre-request Script for Auth
```javascript
// Add to collection pre-request script
if (!pm.environment.get("token")) {
    pm.sendRequest({
        url: pm.environment.get("base_url") + "/api/auth/login",
        method: 'POST',
        header: 'Content-Type: application/json',
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                email: "admin@freightzen.com",
                password: "admin123"
            })
        }
    }, function (err, res) {
        pm.environment.set("token", res.json().token);
    });
}
```

## Error Responses

### 400 Bad Request
```json
{
  "message": "Missing required parameters"
}
```

### 401 Unauthorized
```json
{
  "message": "Invalid credentials"
}
```

### 403 Forbidden
```json
{
  "message": "Forbidden"
}
```

### 404 Not Found
```json
{
  "message": "Not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error"
}
```

## Performance Testing

### Load Test with Apache Bench
```bash
# Test login endpoint
ab -n 1000 -c 10 -p login.json -T application/json \
  http://localhost:5000/api/auth/login

# Test ML prediction
ab -n 100 -c 5 -p truck-rec.json -T application/json \
  http://localhost:8000/predict-truck
```

## Automated Testing Script

```bash
#!/bin/bash
# test-api.sh

BASE_URL="http://localhost:5000"
ML_URL="http://localhost:8000"

echo "Testing FreightZen API..."

# Test ML Service Health
echo "1. Testing ML Service Health..."
curl -s $ML_URL/health | jq

# Test Registration
echo "2. Testing Registration..."
RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test'$(date +%s)'@example.com","password":"test123","name":"Test"}')
TOKEN=$(echo $RESPONSE | jq -r '.token')
echo "Token: ${TOKEN:0:20}..."

# Test Truck Creation
echo "3. Testing Truck Creation..."
curl -s -X POST $BASE_URL/api/trucks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"registrationNo":"TRK-'$(date +%s)'","type":"CONTAINER_20FT","capacityKg":20000,"capacityM3":33}' | jq

# Test ML Prediction
echo "4. Testing Truck Recommendation..."
curl -s -X POST $ML_URL/predict-truck \
  -H "Content-Type: application/json" \
  -d '{"weight_kg":5000,"volume_m3":15,"distance_km":500,"cargo_type":"GENERAL"}' | jq

echo "All tests completed!"
```

## Troubleshooting

### Connection Refused
- Check if services are running
- Verify ports are not blocked
- Check Docker containers: `docker-compose ps`

### 401 Unauthorized
- Token expired (tokens expire after 7 days)
- Invalid token format
- Missing Authorization header

### ML Service Errors
- Check ML service logs: `docker-compose logs ml-service`
- Verify Python dependencies installed
- Check service health: `curl http://localhost:8000/health`

## Best Practices

1. Always check health endpoints first
2. Store tokens securely
3. Handle token expiration
4. Validate input data
5. Check response status codes
6. Log all API calls in production
7. Use environment variables for URLs
8. Implement retry logic for failed requests

## Conclusion

This guide covers all API endpoints in FreightZen. Use these examples to:
- Test functionality
- Integrate with other systems
- Build client applications
- Debug issues
- Performance testing
