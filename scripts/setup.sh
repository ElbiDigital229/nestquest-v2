#!/bin/bash
# NestQuest V2 — Full Setup Script
# Run this on a fresh machine after cloning the repo

set -e

echo "╔══════════════════════════════════════╗"
echo "║    NestQuest V2 — Setup Script       ║"
echo "╚══════════════════════════════════════╝"

# 1. Check prerequisites
echo ""
echo "→ Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install: brew install node"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm not found. Install with Node.js"; exit 1; }

echo "  Node: $(node -v)"
echo "  npm: $(npm -v)"

# 2. Check PostgreSQL
echo ""
echo "→ Checking PostgreSQL..."
if command -v psql >/dev/null 2>&1; then
  echo "  PostgreSQL: $(psql --version)"
elif [ -f /opt/homebrew/opt/postgresql@15/bin/psql ]; then
  export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
  echo "  PostgreSQL (Homebrew): $(psql --version)"
else
  echo "❌ PostgreSQL not found. Install: brew install postgresql@15"
  echo "  Then: brew services start postgresql@15"
  exit 1
fi

# 3. Create database
echo ""
echo "→ Creating database..."
psql -U $(whoami) -d postgres -c "CREATE DATABASE nestquest_v2;" 2>/dev/null || echo "  Database already exists"

# 4. Load schema
echo ""
echo "→ Loading schema..."
psql -d nestquest_v2 -f scripts/schema.sql 2>/dev/null || echo "  Schema may already exist"

# 5. Seed data
echo ""
echo "→ Seeding data..."
psql -d nestquest_v2 -f scripts/seed.sql

# 6. Create .env
echo ""
echo "→ Setting up .env..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created .env from .env.example"
else
  echo "  .env already exists"
fi

# 7. Install dependencies
echo ""
echo "→ Installing npm dependencies..."
npm install

# 8. Create uploads directory with placeholder files
echo ""
echo "→ Setting up uploads directory..."
mkdir -p server/uploads
if [ ! -f server/uploads/property_photo_1.jpg ]; then
  # Create placeholder images
  for i in 1 2 3 4; do
    convert -size 800x600 xc:gray -font Helvetica -pointsize 40 -gravity center -annotate 0 "Property Photo $i" server/uploads/property_photo_$i.jpg 2>/dev/null || \
    echo "placeholder" > server/uploads/property_photo_$i.jpg
  done
  echo "placeholder" > server/uploads/emirates_id_front.png
  echo "placeholder" > server/uploads/emirates_id_back.jpeg
  echo "placeholder" > server/uploads/passport_front.webp
  echo "placeholder" > server/uploads/trade_license.webp
  echo "  Created placeholder upload files"
else
  echo "  Upload files already exist"
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║         Setup Complete! ✓            ║"
echo "╠══════════════════════════════════════╣"
echo "║                                      ║"
echo "║  Start the app:                      ║"
echo "║    npm run dev                        ║"
echo "║                                      ║"
echo "║  Then open:                           ║"
echo "║    http://localhost:5173              ║"
echo "║                                      ║"
echo "║  Test accounts (Password1!):          ║"
echo "║    Admin:   admin@nestquest.com       ║"
echo "║    PM:      pm@nestquest.com          ║"
echo "║    PO:      owner@nestquest.com       ║"
echo "║    Guest:   guest@nestquest.com       ║"
echo "║    Cleaner: cleaner@nestquest.com     ║"
echo "║                                      ║"
echo "╚══════════════════════════════════════╝"
