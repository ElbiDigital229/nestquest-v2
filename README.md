# NestQuest V2

Short-term rental property management platform built for the UAE market.

## Prerequisites

| Dependency | Version | Install |
|-----------|---------|---------|
| Node.js | 18+ | `brew install node` or [nodejs.org](https://nodejs.org) |
| PostgreSQL | 14+ | `brew install postgresql@15` then `brew services start postgresql@15` |
| npm | 9+ | Comes with Node.js |

## Quick Setup

```bash
# Clone the repo
git clone https://github.com/ElbiDigital229/nestquest-v2.git
cd nestquest-v2

# Run the setup script (installs deps, creates DB, loads schema, seeds test data)
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
# Edit .env — at minimum set DATABASE_URL and SESSION_SECRET

# 6. Create uploads directory
mkdir -p server/uploads

# 7. Start the app
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

### Required for local development

```env
DATABASE_URL=postgresql://localhost:5432/nestquest_v2
SESSION_SECRET=any-long-random-string-at-least-32-chars
```

### Optional (features degrade gracefully without these)

```env
# File uploads — defaults to local disk (server/uploads/) if not set
S3_BUCKET=nestquest-uploads
AWS_REGION=me-central-1
# AWS_ACCESS_KEY_ID=       # leave blank if using IAM role on EC2
# AWS_SECRET_ACCESS_KEY=

# Payments — Stripe integration (simulated locally without these)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLIC_KEY=pk_live_...

# Error tracking
SENTRY_DSN=https://...@sentry.io/...

# Redis session store (falls back to PostgreSQL sessions if not set)
# REDIS_URL=redis://localhost:6379

# Production
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com
LOG_LEVEL=info
```

**Local development only needs `DATABASE_URL` and `SESSION_SECRET`.** OTP uses a mock code (`123456`), file uploads go to `server/uploads/`, and payments are simulated.

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
- **Portal**: http://localhost:5173/login → select role → use quick login dropdown in dev mode
- **Admin**: http://localhost:5173/admin/login

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend (Vite :5173) and backend (:3000) |
| `npm run build` | Production build |
| `npm run db:push` | Sync Drizzle schema to DB (alternative to schema.sql) |
| `npm run db:studio` | Open Drizzle Studio (DB GUI) |
| `npm test` | Run test suite |
| `./scripts/setup.sh` | One-command local setup |
| `./scripts/deploy.sh` | Deploy to production server |
| `./scripts/backup.sh` | Backup DB to S3 |
| `./scripts/restore.sh` | Restore DB from S3 backup |

## Ports

| Service | Port |
|---------|------|
| Backend API | 3000 |
| Frontend (Vite dev) | 5173 |
| PostgreSQL | 5432 |
| Redis (optional) | 6379 |

## Architecture

```
client/                   # React 18 + Vite + Tailwind + shadcn/ui
  src/
    pages/
      public/             # Homepage, search, property detail, booking flow
      portal/             # PM, PO, Guest, Cleaner, Team member portals
      auth/               # Login, signup, role selection
      admin/              # Super admin dashboard
    components/
      layout/             # Portal layout, public layout, admin layout
      ui/                 # shadcn/ui components
      st-wizard/          # Property creation wizard steps
    lib/
      nav-config.ts       # Role-based navigation
      auth-context.tsx    # Session auth context

server/                   # Express 5 + TypeScript
  controllers/
    booking.controller.ts # Thin HTTP handlers for booking routes
  services/
    booking.service.ts    # Booking business logic
    booking-lifecycle.ts  # Event-driven side effects (notifications, settlements)
  events/
    booking-emitter.ts    # Typed EventEmitter for booking state changes
  routes/
    auth.ts               # Login, signup, OTP, sessions
    bookings.ts           # Booking CRUD, lifecycle, ledger, reviews
    st-properties.ts      # Property CRUD, analytics, calendar, settlements
    cleaners.ts           # Cleaner accounts, tasks, checklists, automation
    chat.ts               # PM↔Guest↔PO messaging (unified channel)
    team.ts               # PM sub-users, roles, 17 granular permissions
    message-templates.ts  # Automated guest messaging templates
    st-locks.ts           # Smart lock PIN management
    payments.ts           # Stripe webhook + payment processing
    admin.ts              # Super admin endpoints
    public.ts             # Public API (no auth)
  middleware/
    auth.ts               # Session auth, role guards
    pm-permissions.ts     # Granular permission checks for team members
    billing-guard.ts      # Subscription enforcement
    plan-limits.ts        # Feature-level plan limits
    request-id.ts         # Request tracing
  utils/
    settlements.ts        # Auto-create PM-PO settlements on booking confirm
    notify.ts             # In-app notification system
    booking-financials.ts # Financial ledger entries
    sanitize.ts           # XSS prevention (strips HTML tags)
    message-template-trigger.ts  # Fire automated messages with deduplication
    message-trigger-cron.ts      # Cron: check-in/checkout message scheduling
    document-expiry-cron.ts      # Cron: alert on expiring KYC documents
    billing-cron.ts              # Cron: subscription billing
    booking-expiry-cron.ts       # Cron: expire unconfirmed bookings
    logger.ts             # Structured logging (pino)

shared/
  schema.ts               # Drizzle ORM schema (40+ tables, all enums)

scripts/
  schema.sql              # Full PostgreSQL schema
  seed.sql                # Test data (users, properties, bookings)
  setup.sh                # One-command local setup
  deploy.sh               # Production deploy script
  backup.sh               # DB backup to S3
  restore.sh              # Restore from S3 backup
```

## Key Features

### Public Website
- Property search with filters (city, price range, guests, dates, property type)
- Property detail with photos, amenities, policies, availability calendar
- Guest booking flow — price breakdown (weekday/weekend rates, tourism tax, VAT, cleaning fee, security deposit)
- Bank transfer payment details on authenticated payment page

### Property Manager Portal
- **ST Properties**: Full property CRUD via 8-step wizard
- **Calendar**: Multi-property overview + per-property calendar with custom pricing per date
- **Analytics**: Occupancy, ADR, RevPAR, booking sources, per-property performance, monthly trend
- **Bookings**: Full lifecycle (request → confirm → check-in → check-out → complete) + manual bookings
- **Pricing**: Date-specific overrides, weekend rates, minimum stay
- **Inventory**: Item-by-item asset register per property
- **Finances**: Transactions, refunds, PO payouts, owner/PM ledger, reports
- **Settlements**: PM-PO reconciliation (booking payouts, expense reimbursements, deposit forfeitures)
- **Team**: Sub-user management with 17 granular permissions and custom roles
- **Housekeeping**: Cleaner accounts, checklists, task assignments, checkout automation
- **Message Templates**: Automated guest messaging (booking confirmed, check-in day, post-checkout, etc.)
- **Smart Locks**: PIN management linked to booking dates
- **Reviews**: Respond to guest reviews
- **Messages**: Unified PM↔Guest channel (manual + automated messages in one thread)

### Property Owner Portal
- View owned properties with full booking and financial data
- Track PM-PO settlements (confirm receipt of payouts)
- Guest messaging (direct channel to guests who stayed)
- Guest reviews across all owned properties
- Financial reports

### Guest Portal
- Browse and book properties
- My Bookings with full status tracking, security deposit visibility
- Leave reviews after checkout
- Unified message thread with PM

### Cleaner Portal
- Task list with status (pending / in progress / completed)
- Check off checklist items, add notes and photos per item
- Complete tasks (notifies PM automatically)

### Admin Portal
- User management with KYC document tracking and compliance status
- Document expiry monitoring
- Subscription and billing plan management
- Platform-wide transaction view

## Security

- bcrypt password hashing (10 rounds)
- HttpOnly session cookies with session fixation prevention
- Role-based access control (7 roles: SUPER_ADMIN, PROPERTY_MANAGER, PM_TEAM_MEMBER, PROPERTY_OWNER, TENANT, GUEST, CLEANER)
- 17 granular permissions for PM team members
- XSS prevention — all user content sanitized before DB write
- SQL injection prevention — 100% parameterized queries (no string interpolation)
- KYC gate on booking confirmation
- Rate limiting on auth routes and messaging
- Ownership checks on all mutation endpoints
- Generic error messages in production (no stack traces exposed)

## Database

40+ tables. Key ones:

| Table | Purpose |
|-------|---------|
| `users` | All user accounts (all roles) with KYC fields |
| `st_properties` | Short-term rental properties |
| `st_property_photos/amenities/policies/documents` | Property details |
| `st_property_pricing` | Custom per-date price overrides |
| `st_bookings` | Booking lifecycle with full financial snapshot |
| `st_security_deposits` | Deposit hold/return/forfeiture tracking |
| `st_reviews` | Guest reviews with PM response |
| `st_property_inventory` | Asset register per property |
| `st_property_expenses` | Expense tracking |
| `st_transactions` | Full financial ledger |
| `pm_po_settlements` | PM↔PO payout reconciliation |
| `pm_roles` | Custom PM team roles |
| `pm_team_members` | PM sub-users with role assignments |
| `cleaning_tasks/checklists/automation_rules` | Housekeeping system |
| `message_templates` / `message_template_sends` | Automated messaging with dedup |
| `st_property_locks` / `st_lock_pins` | Smart lock management |
| `plans` / `subscriptions` / `invoices` | Billing |
| `notifications` | In-app notification inbox |
| `messages` | Chat messages (conversation_id = user ID) |
| `pm_po_links` | PM↔PO relationship links |
| `otp_verifications` | Phone OTP for signup |
| `user_audit_log` | Security audit trail |
