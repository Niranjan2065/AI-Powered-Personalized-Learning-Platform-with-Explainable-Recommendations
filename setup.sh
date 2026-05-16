#!/bin/bash
# ============================================================
# AILearn Platform — One-command Setup
# ============================================================
set -e

echo "🚀 Setting up AI Learning Platform..."

# Backend
echo "📦 Installing backend dependencies..."
cd backend
[ ! -f .env ] && cp .env.example .env && echo "✅ Created .env — edit with your keys"
npm install

# Frontend
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the platform:"
echo "  Terminal 1: cd backend && npm run dev"
echo "  Terminal 2: cd frontend && npm start"
echo ""
echo "⚠️  Make sure to:"
echo "  1. Edit backend/.env with your MONGO_URI and GROQ_API_KEY"
echo "  2. Have MongoDB running: sudo service mongod start"
echo "  3. (Optional) Start Python AI engine: cd ai_engine && python app.py"
