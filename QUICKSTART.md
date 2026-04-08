# FreightZen - Quick Start Guide

Get FreightZen up and running in 5 minutes!

## 🚀 Fastest Way to Start (Docker)

### Prerequisites
- Docker Desktop installed and running
- Git installed

### Steps

1. **Clone and Start**
```bash
git clone https://github.com/Satvik0609/FreightZen.git
cd FreightZen
docker-compose up -d
```

2. **Wait for Services** (30-60 seconds)
```bash
docker-compose ps
```

3. **Access Application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- ML Service: http://localhost:8000

4. **Login**
- Email: `admin@freightzen.com`
- Password: `admin123`

**That's it! You're ready to go! 🎉**

---

## 🛠️ Manual Setup (Development)

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+

### Windows Quick Start

```bash
# Run the automated setup script
start.bat
```

Then open 3 terminals:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - ML Service:**
```bash
cd ml-service
venv\Scripts\activate
uvicorn main:app --reload
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

### Linux/Mac Quick Start

```bash
# Run the automated setup script
chmod +x start.sh
./start.sh
```

Then open 3 terminals:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - ML Service:**
```bash
cd ml-service
source venv/bin/activate
uvicorn main:app --reload
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## ✅ Verify Installation

### 1. Check Services

**Backend:**
```bash
curl http://localhost:5000/api/auth/login
```
Should return: `{"message":"Email and password required"}`

**ML Service:**
```bash
curl http://localhost:8000/health
```
Should return: `{"status":"healthy","models_loaded":true}`

**Frontend:**
Open http://localhost:3000 in browser

### 2. Test Complete Flow

1. **Register Account**
   - Go to http://localhost:3000
   - Click "Don't have an account? Register"
   - Fill in details and register

2. **Create Truck**
   - Navigate to "Trucks" tab
   - Click "Add Truck"
   - Fill in: Registration No, Type, Capacity
   - Submit

3. **Create Shipment**
   - Navigate to "Shipments" tab
   - Click "Create Shipment"
   - Fill in origin, destination, weight, volume
   - Submit

4. **View Dashboard**
   - Navigate to "Dashboard"
   - See analytics and charts

5. **View Analytics**
   - Navigate to "Analytics"
   - See trends and predictions

---

## 🎯 Quick Test with Sample Data

### Seed Database
```bash
cd backend
npm run seed
```

This creates:
- Admin user: `admin@freightzen.com` / `admin123`
- Dispatcher: `dispatcher@freightzen.com` / `admin123`
- Customer: `customer@example.com` / `admin123`
- 5 sample trucks
- 3 sample shipments

### Test ML Models

**Truck Recommendation:**
```bash
curl -X POST http://localhost:8000/predict-truck \
  -H "Content-Type: application/json" \
  -d '{"weight_kg":5000,"volume_m3":15,"distance_km":500,"cargo_type":"GENERAL"}'
```

**Delivery Time Prediction:**
```bash
curl -X POST http://localhost:8000/predict-delivery-time \
  -H "Content-Type: application/json" \
  -d '{"weight_kg":5000,"distance_km":500,"truck_type":"CONTAINER_20FT","traffic_condition":"MODERATE","weather_condition":"CLEAR"}'
```

**Fuel Estimation:**
```bash
curl -X POST http://localhost:8000/estimate-fuel \
  -H "Content-Type: application/json" \
  -d '{"distance_km":500,"weight_kg":5000,"truck_type":"CONTAINER_20FT"}'
```

---

## 🐛 Troubleshooting

### Port Already in Use

**Windows:**
```bash
# Find process
netstat -ano | findstr :5000
# Kill process
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Find and kill process
lsof -ti:5000 | xargs kill -9
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Restart database
docker restart freightzen-postgres
```

### ML Service Not Starting

```bash
# Check Python version
python --version  # Should be 3.11+

# Reinstall dependencies
cd ml-service
pip install -r requirements.txt
```

### Frontend Build Errors

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Next Steps

1. **Read Documentation**
   - [README.md](README.md) - Project overview
   - [SETUP.md](SETUP.md) - Detailed setup guide
   - [ML_MODELS.md](ML_MODELS.md) - ML documentation
   - [API_TESTING.md](API_TESTING.md) - API testing guide

2. **Explore Features**
   - Create shipments
   - Manage truck fleet
   - Test ML predictions
   - View analytics

3. **Customize**
   - Modify ML models
   - Add new features
   - Customize UI
   - Integrate with other systems

---

## 🎓 Learning Path

### Beginner
1. Start with Docker setup
2. Login and explore UI
3. Create shipments and trucks
4. View dashboard

### Intermediate
1. Test API endpoints
2. Understand ML models
3. Modify frontend components
4. Add new features

### Advanced
1. Train ML models with real data
2. Implement new algorithms
3. Add real-time tracking
4. Deploy to production

---

## 💡 Tips

- Use Docker for quickest setup
- Seed database for sample data
- Check logs for errors
- Use Prisma Studio to view database
- Test ML endpoints directly
- Read API documentation

---

## 🆘 Getting Help

1. Check [SETUP.md](SETUP.md) for detailed instructions
2. Review error logs
3. Test individual services
4. Check Docker container status
5. Open GitHub issue

---

## 🎉 Success Checklist

- [ ] All services running
- [ ] Can access frontend at http://localhost:3000
- [ ] Can login with test credentials
- [ ] Can create shipments
- [ ] Can view dashboard
- [ ] ML predictions working
- [ ] Analytics showing data

**If all checked, you're ready to use FreightZen! 🚀**

---

## 📞 Support

For issues:
- Check logs: `docker-compose logs`
- Review documentation
- Test individual components
- Open GitHub issue

---

**Built with ❤️ for logistics optimization**
