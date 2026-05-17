# AI Smart Office Platform

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **AI**: coze-coding-dev-sdk (LLM)
- **ERP**: Business Central OData V4 API

## Architecture: Multi-Agent System

```
                    Master Agent
  • Task Dispatch • Cross-dept Coordination • Status Tracking • Data Aggregation
              |                   |
   Business Domain Layer    Shared Tool Layer
   • Sales Agent           • Document Parsing
   • Procurement Agent     • Data Query
   • Logistics Agent       • Email Sending
   • Finance Agent         • Report Generation
   • Marketing Agent       • Knowledge Base
              |                   |
                    Shared Data Layer
   • Products • Customers • Orders • Inventory • Suppliers
```

## Directory Structure

```
├── public/                 # Static assets
├── src/
│   ├── app/                # Pages & API routes
│   │   ├── page.tsx        # Dashboard with Master Agent chat
│   │   ├── layout.tsx      # Root layout
│   │   ├── sales/          # Sales department
│   │   ├── procurement/    # Procurement department
│   │   ├── logistics/      # Logistics department
│   │   ├── finance/        # Finance department
│   │   ├── marketing/      # Marketing department
│   │   └── api/
│   │       ├── agent/chat/     # Multi-Agent chat (SSE streaming)
│   │       ├── ai/
│   │       │   ├── parse-email/  # AI email parsing
│   │       │   └── analyze/      # AI streaming analysis
│   │       ├── bc/
│   │       │   ├── sales-lines/  # BC Sales Lines
│   │       │   ├── sales-orders/ # BC Sales Orders
│   │       │   ├── items/        # BC Items
│   │       │   └── stats/        # BC Stats
│   │       └── erp/
│   │           ├── products/     # ERP product query (AI-ranked, top 1-5 per keyword)
│   │           ├── web-search/   # Web search for suppliers & pricing fallback
│   │           ├── orders/       # Historical orders
│   │           └── status/       # Connection status
│   ├── login/                # Login page (BC credential auth)
│   ├── components/
│   │   ├── ui/             # Shadcn UI library
│   │   ├── sidebar.tsx     # Sidebar navigation
│   │   ├── app-shell.tsx   # App shell layout
│   │   ├── agent-chat.tsx  # Agent chat panel
│   │   └── floating-agent.tsx  # Floating agent button
│   ├── lib/
│   │   ├── utils.ts            # Utility functions (cn)
│   │   ├── mock-data.ts        # Mock data for 5 departments
│   │   ├── business-central.ts # BC OData V4 client (session-aware)
│   │   ├── agent-config.ts     # Agent definitions & prompts
│   │   ├── agent-tools.ts      # Shared tool implementations
│   │   ├── auth/session.ts     # JWT session management (encrypted cookie)
│   │   └── env-loader.ts       # Runtime env var loader for production
│   └── hooks/              # Custom hooks
├── middleware.ts            # Auth middleware (protects routes)
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Multi-Agent Details

### Agent Types
| Agent | System Prompt | Specialisation |
|-------|--------------|----------------|
| Master | Task routing, cross-dept coordination | Delegates to department agents |
| Sales | Email parsing, quotation, customer matching | ERP product lookup, pricing |
| Procurement | Supplier comparison, cost optimisation | Inventory alerts, purchase orders |
| Logistics | Shipment tracking, exception handling | Warehouse management, delivery optimisation |
| Finance | Financial analysis, risk detection | Invoice management, AR/AP reporting |
| Marketing | Campaign ROI, lead scoring | Market trends, channel analysis |

### Shared Tools (available to all agents)
| Tool | Description |
|------|-------------|
| query_products | Search BC items by keyword or item number |
| query_orders | Search BC sales orders by customer, order number, or date |
| query_inventory | Check item availability and stock levels |
| query_sales_lines | Search BC sales lines by document, item, or keyword |
| parse_document | Extract structured data from unstructured text |
| generate_report | Generate department-specific reports from BC data |
| search_knowledge | Search internal knowledge base |

### Tool Execution Flow
1. Agent receives user query → determines which tools to use
2. Agent outputs `[TOOL:tool_name(params)]` markers in response
3. System parses tool calls → executes → injects results
4. Agent receives tool data → produces final analysis

## Business Central Integration

- **Endpoint**: OData V4 (Basic Auth)
- **Company**: Allinton Engineering & Trading Pte Ltd
- **Entities**: SalesOrderSalesLines, SalesOrder, workflowItems, Company
- **Auto-fallback**: BC unavailable → mock data
- **Data source**: Each API response includes `source: "business_central" | "mock_fallback"`

## AI-Powered Product Matching

- **Flow**: Email → AI Parse → BC Search (contains) → AI Rank (top 1-5) → Status Feedback
- **AI Ranking**: `POST /api/erp/products` uses LLM (doubao-seed-2-0-lite) to score each BC candidate 0-100 with reason
- **Status per keyword**: `matched` (score >= 80), `partial_match` (50-79), `not_found` (< 50 or no results)
- **Web Search fallback**: `POST /api/erp/web-search` uses SearchClient + LLM for supplier discovery & pricing research
- **Web Search triggered**: Available for `partial_match` and `not_found` items; user clicks button on sales page

## Environment Variables

### Auto-loaded by Platform (dev & prod)
These are automatically injected by the coze platform via `coze_workload_identity`:

| Variable | Description |
|----------|-------------|
| COZE_WORKLOAD_IDENTITY_API_KEY | AI/LLM SDK authentication key |
| COZE_INTEGRATION_BASE_URL | AI/LLM API base URL |
| COZE_INTEGRATION_MODEL_BASE_URL | AI/LLM model API base URL |

### User-configured (must be set for both dev & prod)
These must be configured in the platform's Environment Variables settings:

| Variable | Description |
|----------|-------------|
| BC_ODATA_URL | BC OData V4 base URL |
| BC_USERNAME | Windows auth username (domain\\user) |
| BC_PASSWORD | Windows auth password |
| BC_COMPANY_ID | BC company GUID (auto-detected if not set) |

### Environment Loader (`src/lib/env-loader.ts`)
- In dev: env vars are auto-injected by `coze dev`
- In prod: `ensureEnvLoaded()` calls `coze_workload_identity` Python package to load platform env vars at runtime
- All API routes call `await ensureEnvLoaded()` before accessing env vars
- `server.ts` also calls `ensureEnvLoaded()` at startup

### Production BC Setup
If BC credentials are not in the platform's env vars, you MUST add them via the project's Environment Variables settings in the Coze Coding dashboard. `.env.local` is only available in development.

## Package Manager

**Only pnpm** is allowed. Never use npm or yarn.

## Build & Test Commands

- `pnpm dev` - Start dev server
- `pnpm build` - Build production
- `pnpm ts-check` - TypeScript type check
- `pnpm lint` - ESLint check
- `pnpm lint:build` - ESLint quiet mode
