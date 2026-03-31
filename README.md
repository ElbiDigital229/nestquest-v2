# NestQuest V2

Short-term rental property management platform built for the UAE market.

## Prerequisites

| Dependency | Version | Install |
|-----------|---------|---------|
| Node.js | 18+ | `brew install node` |
| PostgreSQL | 14+ | `brew install postgresql@15` then `brew services start postgresql@15` |
| npm | 9+ | Comes with Node.js |

## Quick Setup

```bash
# Clone the repo
git clone https://github.com/ElbiDigital229/nestquest-v2.git
cd nestquest-v2

# Run the setup script (creates DB, schema, seed data, installs deps)
./scripts/setup.sh

# Start the app
npm run dev
```

Then open **http://localhost:5173**

## Manual Setup

If the setup script doesn't work on your system:

```bash
# 1. Install dependencies
npm install

# 2. Create the database
psql -d postgres -c "CREATE DATABASE nestquest_v2;"

# 3. Load the schema
psql -d nestquest_v2 -f scripts/schema.sql

# 4. Seed test data
psql -d nestquest_v2 -f scripts/seed.sql

# 5. Create .env file
cp .env.example .env

# 6. Create uploads directory
mkdir -p server/uploads

# 7. Start the app
DATABASE_URL="postgresql://localhost:5432/nestquest_v2" npm run dev
```

## Test Accounts

All accounts use password: **Password1!**

| Role | Email | Description |
|------|-------|-------------|
| Super Admin | admin@nestquest.com | Platform administrator |
| Property Manager | pm@nestquest.com | Ahmed Al Maktoum — manages properties |
| Property Owner | owner@nestquest.com | Fatima Al Nahyan — property investor |
| Guest | guest@nestquest.com | James Wilson — short-term renter |
| Cleaner | cleaner@nestquest.com | Ravi Kumar — cleaning staff |

Login pages:
- **Portal**: http://localhost:5173/login (select role, then use quick login dropdown in dev mode)
- **Admin**: http://localhost:5173/admin/login

## Architecture

```
client/                 # React + Vite + Tailwind + shadcn/ui
  src/
    pages/
      public/           # Homepage, search, property detail, booking flow
      portal/           # PM, PO, Guest, Cleaner, Team member portals
      auth/             # Login, signup, role selection
      admin/            # Super admin dashboard
    components/
      layout/           # Portal layout, public layout
      ui/               # shadcn/ui components
      st-wizard/        # Property creation wizard steps

server/                 # Express + TypeScript
  routes/
    auth.ts             # Login, signup, OTP, sessions
    bookings.ts         # Booking CRUD, lifecycle, reviews
    st-properties.ts    # Property CRUD, inventory, pricing, calendar, settlements
    cleaners.ts         # Cleaner accounts, tasks, checklists, automation
    team.ts             # PM sub-users, roles, permissions
    admin.ts            # Admin endpoints
    public.ts           # Public API (no auth needed)
    chat.ts             # PM-PO-Team messaging
  middleware/
    auth.ts             # Session auth, role guards
    pm-permissions.ts   # Granular permission checks for team members
    billing-guard.ts    # Subscription enforcement
  utils/
    settlements.ts      # Auto-create PM-PO settlements
    notify.ts           # Notification system
    booking-financials.ts
    document-expiry-cron.ts
    billing-cron.ts
    booking-expiry-cron.ts
    sanitize.ts         # XSS prevention

shared/
  schema.ts             # Drizzle ORM schema (40+ tables)

scripts/
  schema.sql            # Full database schema
  seed.sql              # Test data
  setup.sh              # One-command setup
```

## Key Features

### Public Website
- Property search with filters (city, price, guests, rating, property type)
- Property detail with photos, amenities, policies, availability calendar
- Airbnb-style price markers on map
- Guest booking flow with price calculation (weekday/weekend rates, VAT, cleaning fee, security deposit)
- Bank transfer details on authenticated payment page

### Property Manager Portal
- **ST Properties**: Full property CRUD via wizard (8 steps)
- **Calendar**: Multi-property overview + per-property calendar with pricing management
- **Bookings**: Full lifecycle (request → confirm → check-in → check-out → complete)
- **Inventory**: Item-by-item asset register per property
- **Investment**: Purchase price, inventory, expenses, revenue, commission, net profit, security deposits
- **Settlements**: PM-PO reconciliation (booking payouts, expense reimbursements, deposit forfeitures)
- **Team**: Sub-user management with 17 granular permissions and custom roles
- **Cleaner Ops**: Cleaner accounts, checklists, task assignments, checkout automation
- **Reviews**: All guest reviews across properties
- **Documents**: Property + user document management with expiry tracking
- **Reports**: Commission earnings across all properties

### Property Owner Portal
- View owned properties with full investment overview
- See all bookings with guest KYC details
- Track settlements (what PM owes)
- View reviews
- Read-only financial dashboard matching PM view

### Guest Portal
- Browse and book properties
- My Bookings with full status tracking
- Leave reviews after checkout
- Profile and document management

### Cleaner Portal
- Task list with checklist items
- Check items off, add notes and photos
- Complete tasks (PM notified)

### Admin Portal
- User management with KYC/compliance tracking
- Document expiry monitoring
- Subscription/billing management
- Platform-wide bookings, reviews, settlements view

### Security
- bcrypt password hashing (10 rounds)
- HttpOnly session cookies
- Role-based access control (7 roles)
- Granular permissions for team members
- XSS sanitization on user input
- SQL injection prevention via parameterized queries

## Environment Variables

```env
DATABASE_URL=postgresql://localhost:5432/nestquest_v2
```

That's it. No external API keys needed for local development. OTP uses mock (code: 123456), payments are simulated, email is logged to console.

## Ports

| Service | Port |
|---------|------|
| Backend API | 3000 |
| Frontend (Vite) | 5173 |
| PostgreSQL | 5432 |

## Database

40+ tables including:
- `users`, `guests` — User accounts and KYC profiles
- `st_properties`, `st_property_photos/amenities/policies/documents` — Property data
- `st_bookings`, `st_security_deposits`, `st_reviews` — Booking lifecycle
- `st_property_inventory`, `st_property_expenses`, `st_property_pricing` — Financials
- `pm_po_settlements` — PM-PO reconciliation ledger
- `pm_roles`, `pm_team_members` — Team management
- `cleaning_tasks`, `cleaning_checklists`, `cleaning_automation_rules` — Cleaner ops
- `plans`, `subscriptions`, `invoices` — Billing
- `notifications`, `messages` — Communication
