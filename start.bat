@echo off
echo 🚀 FreightZen Quick Start Script
echo ==================================
echo.

echo 📋 Checking prerequisites...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install it first.
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install it first.
    exit /b 1
)

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install it first.
    exit /b 1
)

echo ✅ All prerequisites found!
echo.

echo 🐘 Starting PostgreSQL database...
docker run -d --name freightzen-postgres -e POSTGRES_USER=freightzen -e POSTGRES_PASSWORD=freightzen123 -e POSTGRES_DB=freightzen -p 5432:5432 postgres:15-alpine 2>nul || echo Database container already running

echo ⏳ Waiting for database to be ready...
timeout /t 5 /nobreak >nul

echo.
echo 🔧 Setting up Backend...
cd backend
if not exist .env (
    copy .env.example .env
    echo ✅ Created .env file
)

call npm install
call npx prisma generate
call npx prisma db push
echo ✅ Backend setup complete

echo.
echo 🤖 Setting up ML Service...
cd ..\ml-service
if not exist venv (
    python -m venv venv
    echo ✅ Created virtual environment
)

call venv\Scripts\activate
pip install -r requirements.txt
echo ✅ ML Service setup complete
call deactivate

echo.
echo 🎨 Setting up Frontend...
cd ..\frontend
call npm install
echo ✅ Frontend setup complete

cd ..

echo.
echo ✅ Setup Complete!
echo.
echo 📝 To start the application:
echo.
echo Terminal 1 - Backend:
echo   cd backend ^&^& npm run dev
echo.
echo Terminal 2 - ML Service:
echo   cd ml-service ^&^& venv\Scripts\activate ^&^& uvicorn main:app --reload
echo.
echo Terminal 3 - Frontend:
echo   cd frontend ^&^& npm run dev
echo.
echo Or use Docker:
echo   docker-compose up -d
echo.
echo 🌐 Access the application at http://localhost:3000
echo.
echo 📚 Default credentials:
echo   Admin: admin@freightzen.com / admin123
echo   Customer: customer@example.com / admin123
pause
