# Crest Study Consult Blog

**blog.creststudyconsult.com** — International education intelligence.

The content platform for Crest Study Consult LTD, delivering verified, data-driven guidance on study destinations, admissions, student visas, and scholarships for students studying abroad.

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
- 📊 **Study Intelligence** — Destination reports and visa/tuition comparisons
- 🌍 **Global Destinations** — Guidance for the UK, US, Canada, Australia, Germany, and Ireland
- 🔐 **Admin Dashboard** — Modern glass-morphism UI with authentication
- 📱 **Responsive** — Mobile-first design across all pages

## Categories

| Slug | Name |
|------|------|
| `study-destinations` | Study Destinations |
| `admissions` | Admissions |
| `visa-immigration` | Visa & Immigration |
| `scholarships` | Scholarships |
| `study-intelligence` | Study Intelligence |

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

- **Email:** `admin@Crest Study Consult.africa`
- **Password:** `Crest Study ConsultAdmin2025!`

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
docker build -t Crest Study Consult-blog .
docker run -p 3000:3000 Crest Study Consult-blog
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

- Always use the full name **Crest Study Consult** (never "Crest" alone)
- Legal entity: **Crest Study Consult LTD**
- Primary color: teal `#069494`
- Voice: academic, advisory, structured, neutral (warm and inspirational on brand surfaces)

## License

Proprietary — © 2025 Crest Study Consult. All rights reserved.
