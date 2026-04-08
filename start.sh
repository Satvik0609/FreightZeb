#!/bin/bash

echo "🚀 FreightZen Quick Start Script"
echo "=================================="
echo ""

check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command node
check_command npm
check_command python3
check_command docker

echo "✅ All prerequisites found!"
echo ""

echo "🐘 Starting PostgreSQL database..."
docker run -d \
  --name freightzen-postgres \
  -e POSTGRES_USER=freightzen \
  -e POSTGRES_PASSWORD=freightzen123 \
  -e POSTGRES_DB=freightzen \
  -p 5432:5432 \
  postgres:15-alpine 2>/dev/null || echo "Database container already running"

echo "⏳ Waiting for database to be ready..."
sleep 5

echo ""
echo "🔧 Setting up Backend..."
cd backend
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file"
fi

npm install
npx prisma generate
npx prisma db push
echo "✅ Backend setup complete"

echo ""
echo "🤖 Setting up ML Service..."
cd ../ml-service
if [ ! -d venv ]; then
    python3 -m venv venv
    echo "✅ Created virtual environment"
fi

source venv/bin/activate
pip install -r requirements.txt
echo "✅ ML Service setup complete"
deactivate

echo ""
echo "🎨 Setting up Frontend..."
cd ../frontend
npm install
echo "✅ Frontend setup complete"

cd ..

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📝 To start the application:"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd backend && npm run dev"
echo ""
echo "Terminal 2 - ML Service:"
echo "  cd ml-service && source venv/bin/activate && uvicorn main:app --reload"
echo ""
echo "Terminal 3 - Frontend:"
echo "  cd frontend && npm run dev"
echo ""
echo "Or use Docker:"
echo "  docker-compose up -d"
echo ""
echo "🌐 Access the application at http://localhost:3000"
echo ""
echo "📚 Default credentials:"
echo "  Admin: admin@freightzen.com / admin123"
echo "  Customer: customer@example.com / admin123"
