# Crest Study Consult Blog

**blog.creststudyconsult.com** — Editorial intelligence for Nigerian real estate.

The trust-first content platform for Crest Study Consult (RC No. 9054052), delivering data-driven insights, verification guides, and market intelligence for renters, buyers, agents, and diaspora Nigerians navigating the Nigerian property market.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Router 7 (SSR) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL + Prisma 6 |
| Styling | Tailwind CSS 4 |
| Analytics | Plausible |
| Email | Resend |
| CDN | Cloudflare |

## Features

- 📝 **Editorial CMS** — Full article management with status workflow (IDEA → DRAFT → REVIEW → LIVE)
- 🔍 **SEO/AEO Optimized** — JSON-LD schemas, quick answer blocks, FAQ markup for search & AI engines
- 📊 **Market Intelligence** — Research reports and city-level data analysis
- 🌍 **Diaspora Focus** — Remote verification resources for Nigerians abroad
- 🔐 **Admin Dashboard** — Modern glass-morphism UI with authentication
- 📱 **Responsive** — Mobile-first design across all pages

## Categories

| Slug | Name |
|------|------|
| `trust-verification` | Trust & Verification |
| `market-intelligence` | Market Intelligence |
| `renter-agent-guides` | Renter & Agent Guides |
| `diaspora-housing` | Diaspora Housing |
| `policy-infrastructure` | Policy & Infrastructure |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (Neon, Supabase, or local)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and SESSION_SECRET

# Push database schema
npx prisma db push

# Seed initial data (categories, sample article, admin user)
npx prisma db seed
```

### Development

```bash
npm run dev
```

App runs at `http://localhost:5173`

### Database Commands

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:migrate    # Run migrations
npm run db:seed       # Seed initial data
npm run db:studio     # Open Prisma Studio
npm run db:reset      # Reset and re-seed database
```

### Default Admin Credentials

After seeding, log in at `/admin/login`:

- **Email:** `admin@propx.africa`
- **Password:** `PropXAdmin2025!`

⚠️ Change this password immediately in production.

## Project Structure

```
app/
├── components/       # Reusable UI components
│   ├── ui/          # Base UI elements
│   ├── layout/      # Header, Footer, Navigation
│   ├── blog/        # Article cards, category lists
│   ├── seo/         # Schema markup, meta tags
│   ├── forms/       # Newsletter, contact forms
│   └── home/        # Homepage sections
├── routes/          # React Router 7 routes
├── utils/           # Server utilities
│   ├── constants.ts # Brand configuration
│   ├── db.server.ts # Prisma client
│   ├── session.server.ts # Authentication
│   └── queries.server.ts # Database queries
└── root.tsx         # App shell
prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Seed script
```

## URL Structure

| Page | URL |
|------|-----|
| Homepage | `/` |
| Category | `/{category}` |
| Article | `/{category}/{slug}` |
| Research | `/market-intelligence` |
| Admin | `/admin` |
| Sitemap | `/sitemap.xml` |
| RSS Feed | `/feed.xml` |

## Building for Production

```bash
npm run build
```

Output:
```
build/
├── client/    # Static assets (deploy to CDN)
└── server/    # Server-side code
```

## Deployment

### Docker

```bash
docker build -t propx-blog .
docker run -p 3000:3000 propx-blog
```

### Supported Platforms

- Cloudflare Workers
- Fly.io
- Railway
- Render
- AWS ECS
- Google Cloud Run

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection (pooled) |
| `DIRECT_URL` | PostgreSQL connection (direct, for migrations) |
| `SESSION_SECRET` | 32+ character secret for cookies |
| `PLAUSIBLE_DOMAIN` | Analytics domain |
| `RESEND_API_KEY` | Email API key |

## Brand Guidelines

- Always use **Crest Study Consult** (never "PropX" alone)
- Legal entity: **Crest Study Consult (RC No. 9054052)**
- Primary color: teal `#069494`
- Voice: Calm, precise, institutional, editorial

## License

Proprietary — © 2025 Crest Study Consult. All rights reserved.
