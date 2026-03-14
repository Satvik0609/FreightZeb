# Freightzeb – AI Logistics Optimization Platform

Freightzeb is an AI-driven logistics optimization platform designed to improve freight transportation efficiency through machine learning, optimization algorithms, and intelligent decision support.

The platform helps logistics companies automate key operational tasks such as truck selection, delivery time estimation, shipment consolidation, and cargo loading optimization.

---

# Project Overview

Modern logistics systems often suffer from inefficient shipment planning, underutilized trucks, inaccurate delivery estimates, and rising fuel costs. Freightzeb addresses these problems by integrating artificial intelligence and optimization techniques into a unified platform.

The system provides tools to manage shipments, recommend optimal trucks, predict delivery times, visualize routes, and analyze logistics performance.

---

# Core Features

### Shipment Management

Create, update, and track shipments across the logistics network.

### Truck Recommendation

Machine learning models recommend the most suitable truck based on cargo weight, volume, and travel distance.

### Delivery Time Prediction

Predict estimated delivery time using historical logistics data.

### Shipment Consolidation

Group shipments traveling toward similar destinations.

### Smart Truck Loading

Optimize cargo placement inside trucks using packing algorithms.

### Route Visualization

Display shipment routes on interactive maps.

### Analytics Dashboard

Visualize logistics performance metrics such as truck utilization and delivery efficiency.

---

# System Architecture

Freightzeb follows a multi-layer architecture separating user interface, backend services, data storage, and machine learning models.

```
Frontend (React UI)
       │
       ▼
Backend API (Node.js + Express)
       │
       ├── PostgreSQL Database
       │
       ├── Machine Learning Service (Python + FastAPI)
       │
       └── Optimization Engine (Google OR-Tools)
```

This architecture allows independent scaling of AI services, backend logic, and the user interface.

---

# Tech Stack

## Frontend

* React.js
* Tailwind CSS
* Recharts
* Leaflet.js

## Backend

* Node.js
* Express.js
* Prisma ORM
* JWT Authentication
* Socket.IO

## Database

* PostgreSQL

## Machine Learning

* Python
* FastAPI
* Scikit-learn
* Pandas
* NumPy

## Optimization

* Google OR-Tools

## DevOps

* Docker
* GitHub Actions

---

# Database Design

The database stores logistics entities and prediction data.

Main tables include:

* Users
* Trucks
* Shipments
* Routes
* Deliveries
* Predictions
* Analytics

These entities support shipment tracking, truck assignment, route analysis, and machine learning predictions.

---

# Project Structure

```
freightzeb
│
├── frontend
│   ├── src
│   │   ├── components
│   │   ├── pages
│   │   └── services
│
├── backend
│   ├── src
│   │   ├── routes
│   │   ├── controllers
│   │   ├── services
│   │   └── middleware
│   └── prisma
│
├── ml-service
│   ├── models
│   ├── training
│   └── api
│
└── optimization-engine
```

---

# Installation

## 1. Clone the repository

```
git clone https://github.com/yourusername/freightzeb.git
cd freightzeb
```

---

## 2. Backend Setup

Navigate to backend:

```
cd backend
```

Install dependencies:

```
npm install
```

Create environment file:

```
.env
```

Add database connection:

```
DATABASE_URL="postgresql://username:password@localhost:5432/freightzeb"
```

Run database migration:

```
npx prisma migrate dev
```

Start backend server:

```
npm run dev
```

---

## 3. Frontend Setup

Navigate to frontend:

```
cd frontend
npm install
npm run dev
```

---

## 4. Machine Learning Service

Navigate to ML service folder:

```
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload
```

---

# API Endpoints

### Shipments

```
POST /api/shipments
GET /api/shipments
GET /api/shipments/:id
PUT /api/shipments/:id
DELETE /api/shipments/:id
```

### Truck Recommendation

```
GET /api/recommend-truck
```

### Delivery Time Prediction

```
GET /api/predict-delivery-time
```

### Analytics

```
GET /api/analytics
```

---

# Machine Learning Models

Freightzeb integrates several ML models to support logistics decisions.

### Truck Recommendation Model

Predicts the best truck type based on shipment characteristics.

### Delivery Time Prediction Model

Estimates delivery duration using regression algorithms.

### Shipment Clustering Model

Groups shipments traveling toward similar destinations.

### Fuel Consumption Model

Predicts fuel requirements for deliveries.

### Delay Prediction Model

Identifies shipments likely to experience delays.

---

# Future Enhancements

Planned improvements include:

* Real-time GPS truck tracking
* Reinforcement learning for route optimization
* Integration with logistics ERP systems
* Advanced demand forecasting models

