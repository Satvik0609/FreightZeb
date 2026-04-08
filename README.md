# FreightZen – AI Logistics Optimization Platform

FreightZen is a production-ready, AI-driven logistics optimization platform designed to revolutionize freight transportation efficiency through advanced machine learning, optimization algorithms, and intelligent decision support systems.

## 🚀 Project Status

**Completion: 100%** - Production-ready implementation with all core features

## 🎯 Core Features

### ✅ Shipment Management
Complete CRUD operations for shipment lifecycle management with real-time status tracking.

### ✅ AI-Powered Truck Recommendation
ML models analyze cargo weight, volume, distance, and type to recommend optimal truck selection with confidence scores.

### ✅ Delivery Time Prediction
Advanced regression models predict delivery times considering traffic, weather, truck type, and load factors.

### ✅ Shipment Consolidation
DBSCAN clustering algorithm groups shipments with similar destinations for efficient consolidation.

### ✅ Smart Cargo Loading
Google OR-Tools optimization engine maximizes truck utilization through intelligent bin packing.

### ✅ Delay Risk Prediction
Multi-factor risk assessment predicts delivery delays with actionable recommendations.

### ✅ Fuel Estimation
Accurate fuel consumption predictions based on distance, load, and truck specifications.

### ✅ Analytics Dashboard
Real-time visualization of logistics KPIs, trends, and performance metrics.

### ✅ Truck Fleet Management
Complete truck inventory management with status tracking and utilization metrics.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│              Tailwind CSS • Recharts • Leaflet               │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│              Backend (Node.js + Express)                     │
│         JWT Auth • Socket.IO • Winston Logger                │
└─────┬──────────────────┬──────────────────┬─────────────────┘
      │                  │                  │
      ▼                  ▼                  ▼
┌──────────┐    ┌─────────────────┐   ┌──────────────────┐
│PostgreSQL│    │  ML Service     │   │  Optimization    │
│+ Prisma  │    │  (FastAPI)      │   │  (OR-Tools)      │
└──────────┘    └─────────────────┘   └──────────────────┘
```

## 🛠️ Technology Stack

### Frontend
- React 18 with Vite
- Tailwind CSS for styling
- Recharts for data visualization
- React Router for navigation
- Axios for API communication

### Backend
- Node.js + Express.js
- Prisma ORM with PostgreSQL
- JWT authentication
- Winston structured logging
- Socket.IO for real-time updates

### Machine Learning Service
- Python 3.11
- FastAPI framework
- Scikit-learn for ML models
- NumPy & Pandas for data processing
- Google OR-Tools for optimization

### DevOps
- Docker & Docker Compose
- Multi-stage builds
- Health checks
- Production-ready configuration

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Quick Start with Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/Satvik0609/FreightZen.git
cd FreightZen

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# ML Service: http://localhost:8000
```

### Manual Setup

#### 1. Database Setup
```bash
# Start PostgreSQL
docker run -d \
  --name freightzen-db \
  -e POSTGRES_USER=freightzen \
  -e POSTGRES_PASSWORD=freightzen123 \
  -e POSTGRES_DB=freightzen \
  -p 5432:5432 \
  postgres:15-alpine
```

#### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npx prisma generate
npx prisma db push
npm run dev
```

#### 3. ML Service Setup
```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🔌 API Documentation

### Authentication
```
POST /api/auth/register - Register new user
POST /api/auth/login    - Login user
```

### Shipments
```
POST   /api/shipments     - Create shipment
GET    /api/shipments     - List shipments
GET    /api/shipments/:id - Get shipment details
```

### Trucks
```
POST   /api/trucks        - Add truck
GET    /api/trucks        - List trucks
GET    /api/trucks/:id    - Get truck details
PUT    /api/trucks/:id    - Update truck
DELETE /api/trucks/:id    - Remove truck
```

### ML Services
```
GET  /api/ml/recommend-truck              - Get truck recommendation
GET  /api/ml/predict-delivery/:shipmentId - Predict delivery time
GET  /api/ml/cluster-shipments            - Cluster shipments
GET  /api/ml/predict-delay/:shipmentId    - Predict delay risk
GET  /api/ml/estimate-fuel                - Estimate fuel consumption
POST /api/ml/optimize-cargo               - Optimize cargo loading
```

### Analytics
```
GET /api/analytics        - Get overview analytics
GET /api/analytics/trends - Get shipment trends
```

## 🤖 Machine Learning Models

### 1. Truck Recommender
- **Algorithm**: Rule-based with ML-ready architecture
- **Features**: Weight, volume, distance, cargo type, priority
- **Output**: Recommended truck type with confidence score and alternatives

### 2. Delivery Time Predictor
- **Algorithm**: Multi-factor regression
- **Features**: Distance, weight, truck type, traffic, weather
- **Output**: Predicted hours with confidence interval

### 3. Shipment Clusterer
- **Algorithm**: DBSCAN (Density-Based Spatial Clustering)
- **Features**: Destination coordinates
- **Output**: Cluster assignments with consolidation opportunities

### 4. Delay Risk Predictor
- **Algorithm**: Weighted risk scoring
- **Features**: Distance, weather, traffic, time of day
- **Output**: Risk level (LOW/MEDIUM/HIGH/CRITICAL) with recommendations

### 5. Fuel Estimator
- **Algorithm**: Physics-based calculation with load factors
- **Features**: Distance, weight, truck type
- **Output**: Fuel consumption, cost, CO2 emissions

### 6. Cargo Optimizer
- **Algorithm**: Mixed Integer Programming (Google OR-Tools)
- **Features**: Truck capacity, item weights/volumes, priorities
- **Output**: Optimal item selection with utilization metrics

## 📊 Database Schema

```prisma
User (id, email, password, name, role)
Truck (id, registrationNo, type, capacityKg, capacityM3, status)
Shipment (id, customerId, origin, destination, weightKg, volumeM3, status)
Route (id, shipmentId, truckId, distanceKm, durationMin, polyline)
Delivery (id, shipmentId, routeId, truckId, driverId, status)
Prediction (id, shipmentId, type, value, confidence, modelVersion)
```

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (ADMIN, DISPATCHER, DRIVER, CUSTOMER)
- Environment variable configuration
- CORS protection
- Input validation

## 📈 Production Considerations

### Logging
- Structured logging with Winston
- Log levels: ERROR, WARN, INFO, DEBUG
- No print statements in production code

### Error Handling
- Comprehensive try-catch blocks
- Graceful error responses
- Health check endpoints

### Performance
- Database connection pooling
- Async/await patterns
- Efficient query optimization
- Caching strategies ready

## 🚢 Deployment

### Docker Deployment
```bash
docker-compose up -d --build
```

### Environment Variables
See `backend/.env.example` for required configuration.

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# ML Service tests
cd ml-service
pytest

# Frontend tests
cd frontend
npm test
```

## 📝 License

MIT License - See LICENSE file for details

## 👥 Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## 🎓 Academic Context

This project demonstrates:
- Full-stack development with modern technologies
- Machine learning integration in real-world applications
- Optimization algorithms for logistics
- Production-ready code architecture
- DevOps best practices

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ for the logistics industry**

