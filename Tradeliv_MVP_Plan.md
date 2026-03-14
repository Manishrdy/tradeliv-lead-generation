# TradeLiv — MVP Technical Plan

## 1. Product Summary

**TradeLiv** is a B2B sourcing and order orchestration platform connecting interior designers, furniture brands, and end clients. The core value proposition is a **cross-brand comparison workflow** — designers compare furniture across multiple brands inside a project context, shortlist items with their client, and place a single bulk order that the platform splits into brand-specific purchase orders. 

---

## 2. MVP Scope

### Tier 1 — Build Now (Proves the Core Workflow)

| Module | MVP Implementation |
|---|---|
| **Designer Onboarding** | Simple signup/signin with JWT + bcrypt. No background checks, no email verification. Manual approval gate (approved/rejected). |
| **Project CRUD** | Designer creates clients, projects with budget ranges, and room-level briefs including dimensions (sq.ft). Basic CRUD operations. |
| **Catalog + Comparison** | Cross-brand product comparison view with dimensions, finishes, lead times, MRP. Pin-and-compare mechanism (pin one product, compare against others). Trade discount logic (default vs. negotiated, greater wins). Data sourced via **Claude API with web search** (see Section 5). |
| **SKU Caching** | Scraped products are cached by source URL. Repeated scrapes of the same URL return cached data. Previously scraped products are available in a global catalog for all designers. |
| **Designer & Client Notes** | Designers capture client requirements, preferences, and internal notes during furniture selection. Client notes and designer notes are private to their respective roles — never cross-visible. |
| **Shortlisting + Cart + Order** | Designer shortlists products, locks variants, builds a cart, submits one bulk order. Platform splits into brand-specific POs. Stripe test mode for payment. |

### Tier 2 — Post-Traction

- Brand portal with fulfillment tracking and catalog self-service
- Full client portal with approval actions and delivery tracking
- Real notification system (email/push)

### Tier 3 — Post-Funding

- Stripe Connect split settlements
- Exception handling, partial delivery, reconciliation
- Document verification and compliance automation
- Work order closure logic

### Deliberately Excluded from MVP

- No real brand integrations (Claude API extracts catalog data)
- No background checks or document verification
- No payment splitting or settlement logic
- No real-time fulfillment tracking
- No exception/returns workflow
- No email verification

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | Next.js (App Router) + Tailwind CSS + shadcn/ui | Industry standard, fast UI dev, built-in SSR, component library out of the box |
| **Backend** | Node.js + Express.js + TypeScript | Familiar (Express), TypeScript catches bugs in a multi-entity system with complex status models |
| **ORM** | Prisma | Type-safe queries, auto migrations, schema as single source of truth |
| **Database** | PostgreSQL via Supabase (free tier) | Hosted, 500MB free, dashboard for demos, standard Postgres underneath, easy migration path to AWS RDS later |
| **Auth** | JWT + bcrypt (self-managed in Express) | Simple, no vendor lock-in, sufficient for MVP |
| **Catalog Data** | Claude API (Sonnet) + web search tool | Scrapes and normalizes product data from any furniture brand URL into structured JSON. No per-site scraper maintenance. |
| **Payments** | Stripe (test mode) | Industry standard, clean SDK, sandbox ready |
| **Testing** | Jest + Supertest | Unit tests + API endpoint testing, single framework |
| **Containerization** | Docker | Consistent dev/prod environments |
| **Deployment** | Oracle Cloud free tier (Ubuntu, 4 ARM cores, 24GB RAM) | Free forever, generous specs |
| **Web Server** | Nginx (reverse proxy) | SSL termination, static file serving, production-ready |
| **SSL** | Certbot (Let's Encrypt) via Nginx | Free, auto-renewal |
| **Domain** | Any registrar (~$10-15) | Namecheap or Cloudflare Registrar recommended |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│           Next.js + Tailwind + shadcn/ui             │
│                                                      │
│  Designer Dashboard │ Client View │ Admin Panel      │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────┐
│                    BACKEND                           │
│            Express.js + TypeScript                   │
│                                                      │
│  Auth │ Projects │ Catalog │ Orders │ Discount Logic │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │        Catalog Ingestion Service            │     │
│  │  Claude API (Sonnet) + Web Search Tool      │     │
│  │  URL → Scrape → Normalize → Structured JSON │     │
│  └─────────────────────────────────────────────┘     │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
┌──────────▼──────────┐    ┌─────────▼────────────┐
│     PostgreSQL       │    │    Stripe (Test)      │
│  (Supabase hosted)   │    │    Payment Gateway    │
│                      │    │                       │
│  Designers, Clients  │    └──────────────────────┘
│  Projects, Products  │
│  Orders, POs, Logs   │
└─────────────────────┘
```

---

## 5. Catalog Data Pipeline — Claude API Approach

### Why Claude API Instead of Traditional Scraping

- Furniture brand websites use JavaScript-heavy SPAs with anti-bot protection
- Traditional scrapers (Apify, Puppeteer) fail on major brands or require expensive residential proxies
- Claude API with web search handles extraction and normalization in a single call
- No per-site scraper maintenance — Claude adapts to any page structure

### API Configuration

**Endpoint:** `POST https://api.anthropic.com/v1/messages`

**Headers:**

| Key | Value |
|---|---|
| Content-Type | application/json |
| x-api-key | `<CLAUDE_API_KEY>` |
| anthropic-version | 2023-06-01 |

**Request Payload:**

```json
{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 4096,
    "system": "You are a furniture product data extractor. When given a product_url, search for that page, extract ALL product listings, and return ONLY a valid JSON array. No markdown, no backticks, no explanation. Each object must follow this exact format: {\"product_name\": \"\", \"product_price\": \"\", \"product_image\": \"\", \"product_url\": \"\", \"product_metadata\": \"\"}. product_metadata should contain any additional info like dimensions, materials, finishes, or ratings.",
    "messages": [
        {
            "role": "user",
            "content": "Extract all products from this page.\nproduct_url: <TARGET_URL>"
        }
    ],
    "tools": [
        {
            "type": "web_search_20250305",
            "name": "web_search"
        }
    ]
}
```

### Backend Integration Pattern

```typescript
// services/catalogExtractor.ts

async function extractProducts(productPageUrl: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are a furniture product data extractor...`, // system prompt above
      messages: [
        {
          role: "user",
          content: `Extract all products from this page.\nproduct_url: ${productPageUrl}`,
        },
      ],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  const data = await response.json();

  // Extract JSON from Claude's response
  const textBlock = data.content.find((block: any) => block.type === "text");
  const products = JSON.parse(textBlock.text);

  // Validate before DB insert
  return products.filter(validateProduct);
}
```

### Cost Estimate (MVP Scale)

- Claude Sonnet: ~$0.003-0.01 per product page extraction
- 50-200 products across 3-5 brands: < $1 total
- Negligible at MVP scale

---

## 6. Database Models (MVP)

### Designer Notes & Client Requirement Fields

When a designer adds furniture to a room, the following data points are captured:

**Client-provided requirements (captured during room brief):**
- Room purpose / usage description
- Preferred style keywords
- Color palette preferences
- Material preferences (e.g., "no glass tables, kids in house")
- Seating capacity needs
- Functional constraints (e.g., "needs storage underneath", "must fit through 30-inch doorway")
- Inspiration references / moodboard links
- Budget priority (quality vs. quantity vs. specific pieces)

**Designer notes (captured during shortlisting and comparison):**
- Why this product was selected (internal reasoning)
- Alternatives considered
- Fit assessment notes (dimensions vs. room)
- Customization requests to note for brand
- Installation considerations
- Pairing notes (e.g., "goes with the rug from Brand X")
- Priority ranking within the room

**Visibility rules:**
- `designer_notes` → visible to designer only (never shown in client portal)
- `client_notes` → visible to client only (client's comments/feedback on shortlisted items)
- `shared_notes` → visible to both (e.g., agreed decisions, confirmed preferences)

### Core Tables

```
┌─────────────────────────────────────────────────────────────┐
│ designers                                                    │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ email               VARCHAR UNIQUE NOT NULL                  │
│ password_hash       VARCHAR NOT NULL                         │
│ full_name           VARCHAR NOT NULL                         │
│ business_name       VARCHAR                                  │
│ phone               VARCHAR                                  │
│ status              ENUM (pending_review, approved,          │
│                           rejected, suspended)               │
│ created_at          TIMESTAMP                                │
│ updated_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ clients                                                      │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ designer_id         UUID FK → designers.id                   │
│ name                VARCHAR NOT NULL                         │
│ email               VARCHAR                                  │
│ phone               VARCHAR                                  │
│ billing_address     JSONB                                    │
│ shipping_address    JSONB                                    │
│ access_code         VARCHAR (for client portal login)        │
│ created_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ projects                                                     │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ designer_id         UUID FK → designers.id                   │
│ client_id           UUID FK → clients.id                     │
│ name                VARCHAR NOT NULL                         │
│ description         TEXT                                     │
│ status              ENUM (draft, active, ordered, closed)    │
│ budget_min          DECIMAL                                  │
│ budget_max          DECIMAL                                  │
│ style_preference    VARCHAR (placeholder/free-text)          │
│ created_at          TIMESTAMP                                │
│ updated_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ rooms                                                        │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ project_id          UUID FK → projects.id                    │
│ name                VARCHAR NOT NULL                         │
│ length_ft           DECIMAL                                  │
│ width_ft            DECIMAL                                  │
│ height_ft           DECIMAL                                  │
│ area_sqft           DECIMAL (computed or stored)             │
│ category_needs      TEXT[] (array: sofa, table, bed, etc.)   │
│ budget_min          DECIMAL                                  │
│ budget_max          DECIMAL                                  │
│ client_requirements JSONB (color, material, style, capacity, │
│                           constraints, inspiration links)    │
│ notes               TEXT                                     │
│ created_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ products (global catalog — cached scraped items)             │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ source_url          VARCHAR NOT NULL (product page URL)      │
│ scrape_batch_id     UUID FK → scrape_batches.id              │
│ product_name        VARCHAR NOT NULL                         │
│ brand_name          VARCHAR                                  │
│ price               DECIMAL                                  │
│ image_url           VARCHAR                                  │
│ product_url         VARCHAR                                  │
│ dimensions          JSONB (L, W, H, D, weight)              │
│ material            VARCHAR                                  │
│ finishes            TEXT[]                                   │
│ lead_time           VARCHAR                                  │
│ metadata            JSONB (any additional extracted data)    │
│ category            VARCHAR (sofa, table, bed, etc.)         │
│ is_active           BOOLEAN DEFAULT true                     │
│ created_at          TIMESTAMP                                │
│ updated_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ scrape_batches (SKU caching — dedup by source URL)           │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ source_collection   VARCHAR NOT NULL UNIQUE                  │
│                     (the collection/category page URL)       │
│ scraped_by          UUID FK → designers.id (nullable,        │
│                     null if admin-triggered)                 │
│ product_count       INTEGER                                  │
│ status              ENUM (pending, completed, failed)        │
│ scraped_at          TIMESTAMP                                │
│ expires_at          TIMESTAMP (cache TTL, e.g., 7 days)     │
│ raw_response        JSONB (Claude API raw output for debug) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ shortlist_items                                              │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ project_id          UUID FK → projects.id                    │
│ room_id             UUID FK → rooms.id                       │
│ product_id          UUID FK → products.id                    │
│ designer_id         UUID FK → designers.id                   │
│ selected_variant    JSONB (finish, size, color, upholstery) │
│ quantity            INTEGER DEFAULT 1                        │
│ status              ENUM (suggested, approved, rejected,     │
│                           added_to_cart)                     │
│ designer_notes      TEXT (private to designer)               │
│ client_notes        TEXT (private to client)                 │
│ shared_notes        TEXT (visible to both)                   │
│ fit_assessment      TEXT (designer's dimension vs. room      │
│                          analysis)                           │
│ priority_rank       INTEGER (within room)                    │
│ is_pinned           BOOLEAN DEFAULT false                    │
│                     (pinned for comparison)                  │
│ created_at          TIMESTAMP                                │
│ updated_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ pinned_comparisons                                           │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ project_id          UUID FK → projects.id                    │
│ room_id             UUID FK → rooms.id (nullable)            │
│ designer_id         UUID FK → designers.id                   │
│ pinned_product_id   UUID FK → products.id                    │
│                     (the reference product to compare against)│
│ compared_product_ids UUID[] (products being compared to pin) │
│ created_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ cart_items                                                    │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ project_id          UUID FK → projects.id                    │
│ product_id          UUID FK → products.id                    │
│ room_id             UUID FK → rooms.id                       │
│ selected_variant    JSONB                                    │
│ quantity            INTEGER NOT NULL                         │
│ unit_price          DECIMAL                                  │
│ created_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ orders                                                       │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ project_id          UUID FK → projects.id                    │
│ designer_id         UUID FK → designers.id                   │
│ status              ENUM (draft, submitted, paid,            │
│                           split_to_brands, closed)           │
│ total_amount        DECIMAL                                  │
│ tax_amount          DECIMAL                                  │
│ stripe_payment_id   VARCHAR                                  │
│ created_at          TIMESTAMP                                │
│ updated_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ order_line_items                                             │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ order_id            UUID FK → orders.id                      │
│ product_id          UUID FK → products.id                    │
│ brand_po_id         UUID FK → brand_purchase_orders.id       │
│ room_id             UUID FK → rooms.id                       │
│ selected_variant    JSONB                                    │
│ quantity            INTEGER                                  │
│ unit_price          DECIMAL                                  │
│ line_total          DECIMAL                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ brand_purchase_orders                                        │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ order_id            UUID FK → orders.id                      │
│ brand_name          VARCHAR NOT NULL                         │
│ status              ENUM (sent, acknowledged, in_production, │
│                           dispatched, delivered, cancelled)  │
│ subtotal            DECIMAL                                  │
│ created_at          TIMESTAMP                                │
│ updated_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ audit_logs                                                   │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                         │
│ actor_type          ENUM (designer, client, admin, system)   │
│ actor_id            UUID                                     │
│ action              VARCHAR (e.g., 'product_shortlisted',    │
│                     'order_placed', 'scrape_triggered')      │
│ entity_type         VARCHAR (project, order, product, etc.)  │
│ entity_id           UUID                                     │
│ payload             JSONB (request/response data for debug)  │
│ created_at          TIMESTAMP                                │
└─────────────────────────────────────────────────────────────┘
```

### SKU Caching Logic

```
Designer or Admin triggers "Import from URL"
  → Check scrape_batches for matching source_collection URL
    → IF exists AND NOT expired (expires_at > now)
        → Return cached products from products table
        → Skip Claude API call entirely
    → IF exists AND expired
        → Re-scrape via Claude API
        → Upsert products (update existing, add new)
        → Update scrape_batch timestamp and expires_at
    → IF not exists
        → Scrape via Claude API
        → Insert new scrape_batch record
        → Insert all products with scrape_batch_id
        → Products now visible to ALL designers in global catalog
```

---

## 7. Key Business Logic for MVP

### Discount Resolution

```
IF designer has negotiated discount with brand
  AND negotiated discount > brand default discount
    THEN apply negotiated discount
ELSE
    apply brand default discount
```

### Order Splitting

```
Designer places 1 project order (N items across M brands)
    → Platform generates M brand-specific POs
    → Each PO contains only that brand's line items
    → Single project order view preserved for designer and client
```

### Status Models (MVP Subset)

| Object | Statuses |
|---|---|
| Designer Account | Draft → Under Review → Approved / Rejected |
| Project | Draft → Active → Ordered → Closed |
| Shortlist Item | Suggested → Approved → Added to Cart |
| Project Order | Draft → Submitted → Paid → Split to Brands → Closed |
| Brand PO | Sent → Acknowledged → Delivered |

---

## 7. MVP Demo Flow

The investor demo should walk through this complete loop:

1. Designer signs up → gets approved
2. Creates a client and project with room briefs
3. Platform shows cross-brand furniture comparison (data from Claude API extraction)
4. Designer shortlists items, client reviews in shared view
5. Designer locks variants, builds cart, places one order
6. System generates separate brand POs from the single order
7. Stripe test mode processes payment

This loop proves: legitimate designer gate → structured sourcing workflow → cross-brand comparison (Furnlo's wedge) → single order / multi-PO orchestration.

---

## 8. Deployment Architecture

```
Domain (registrar) → Cloudflare DNS (optional)
    │
    ▼
Oracle Cloud Ubuntu VM (free tier)
    │
    ├── Nginx (reverse proxy + SSL via Certbot)
    │     ├── / → Next.js frontend (port 3000)
    │     └── /api → Express backend (port 4000)
    │
    ├── Docker containers
    │     ├── next-app
    │     └── express-api
    │
    └── Supabase (external, hosted Postgres)
```

---

## 9. Immediate Next Steps

1. **Database schema design** — define tables for designers, clients, projects, rooms, products, shortlists, orders, POs, and discount mappings
2. **Express + Prisma boilerplate** — project setup with TypeScript, auth middleware, and base routes
3. **Catalog extraction service** — Claude API integration as a standalone service module
4. **Frontend scaffolding** — Next.js project with role-based routing (designer / client / admin views)
5. **Comparison workflow UI** — the core product wedge that makes or breaks the demo

---

*Document prepared as MVP technical blueprint for Furnlo*
*Last updated: March 12, 2026*
