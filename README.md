# Design Pulse

## 1. Project Overview

Design Pulse is an enterprise-grade Pre-Construction Decision Engine and Design Coordination Tracker designed specifically for commercial construction. It bridges the gap between pre-construction estimates and architectural execution by transforming static, disconnected spreadsheets into an interactive, spatial, and auditable state-machine. 

By centralizing Value Engineering (VE) data and design updates into a single source of truth, Design Pulse eliminates "decision amnesia" and ensures that approved financial options seamlessly translate into actionable design coordination pipelines.

## 2. Core Features

- **Tri-State Master-Detail Grid:** A high-performance Value Engineering matrix featuring an Excel-like keyboard navigation experience. Supports flat dense tables, split detail panels, and pop-out isolated views for rapid data entry and evaluation.
- **Design Coordination Tracker:** A drag-and-drop Kanban pipeline for managing architectural and MEP drawing updates directly downstream from locked financial decisions.
- **Permits Tracker:** A specialized workspace for managing complex permit lifecycles, featuring both a high-fidelity Board view for status tracking and a Table view for granular detail management.
- **Bulk Import Engine:** A high-performance Excel/CSV processing pipeline that utilizes client-side chunking and set-based PostgreSQL operations to import hundreds of records instantly.
- **Advanced Multi-Select Filtering:** Powerful data exploration capabilities allowing for multiple concurrent selections across Building Areas, Cost Codes, and Disciplines.
- **Role-Based Access Control (RBAC):** Dynamic, granular permissions (Owner, GC Admin, Design Team, Viewer) controlled securely at the database level via PostgreSQL Row Level Security (RLS).
- **Financial Immutability & Audit Trails:** A robust soft-delete architecture paired with strict database triggers to lock approved budgets, ensure financial calculation accuracy, and track comprehensive historical changes.

## 3. Tech Stack Glossary

### Frontend
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand (Global State)
- **Data Fetching & Caching:** TanStack Query
- **Data Grid:** TanStack Table
- **Drag-and-Drop:** `@dnd-kit`
- **Spatial/Canvas:** `react-konva`

### Backend
- **Platform:** Supabase (PostgreSQL)
- **Security:** Row Level Security (RLS) & RPC Stored Procedures
- **Realtime:** WebSockets for live sync
- **Storage:** Supabase Storage
- **Microservices:** Python/FastAPI (Heavy PDF processing)

## 4. Local Setup & Installation

Follow these steps to run the Next.js development server locally.

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd design-pulse
   ```

2. **Install frontend dependencies:**
   Navigate to the Next.js directory and install the packages.
   ```bash
   cd designpulse-next
   npm install
   # or yarn install
   ```

3. **Database Schema:**
   The database architecture is defined in the `supabase_schema.sql` file located in the root directory. Execute this file in your Supabase SQL editor to scaffold the tables, RLS policies, functions, and triggers.

4. **Start the development server:**
   ```bash
   npm run dev
   # or yarn dev
   ```
   The application will be accessible at `http://localhost:3000`.

## 5. Environment Variables

Create a `.env.local` file inside the `designpulse-next` directory. Below is the required template (do not commit actual secret values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Procore Integration (OAuth)
NEXT_PUBLIC_PROCORE_CLIENT_ID=
```

## 6. Release Notes

---

### v0.6 — Escalation Workflow Hardening & Category-Controlled Coordination Routing
**Released:** 2026-05-06

This release hardens the bridge between the **Value Matrix** (Pre-Construction) and the **Coordination Board** (Design Team), eliminating data loss risks, cleaning up board noise, and giving project admins per-category control over what triggers a coordination task.

#### New Features

**Category-Controlled Coordination Routing**
Project admins can configure each dropdown category in **Project Settings → Categories** with a **"No Coord Default"** toggle. When ON, selecting that category on a contender automatically pre-fills the *Requires Coordination* toggle to OFF. This prevents categories like "Already in Plans/Specs" from generating coordination tasks on the board when locked.
- _Location:_ Project Settings → Categories tab
- _Storage:_ `project_settings.categories` (`CategoryConfig[]` — `{id, label, no_coord_default}`)
- _Logic:_ `SortableContenderCard.tsx` → `onChange` on the category `<select>`

**Safe De-escalation ("Recall from Value Matrix")**
Coordination Board items escalated to the Value Matrix now have a safe reversal path. The delete button context-switches to **"Remove from Value Matrix"**, calling the new `de_escalate_opportunity` RPC. This atomically resets financials to zero, unlocks contender options, and strips the escalation flag — without touching the original Coordination record.
- _Location:_ `ExpandedCard.tsx` (Value Matrix detail panel)
- _RPC:_ `public.de_escalate_opportunity(p_opp_id UUID)` — SECURITY DEFINER
- _Pattern:_ Non-Destructive State Reversal (AGENTS.md C31)

**VE Selection Details — Always Visible for Locked Records**
The VE Selection Details card in the Coordination Detail Panel now renders for any record that has a locked contender, regardless of record origin. Previously this was hidden for some escalated items due to a record type guard.
- _Location:_ `CoordinationDetailPanel.tsx`

**Escalation Button UX Parity**
The escalation button now reads **"Escalate to Value Matrix"** / **"Recall from Value Matrix"** with descriptive tooltips explaining each action.
- _Location:_ `CoordinationDetailPanel.tsx`

#### Bug Fixes

**Coordination Board Filter — Dead Status Removed**
Removed `'Pending Plan Update'` from the board filter (a phantom status the lock RPC never writes). Board visibility is now strictly `coordination_status !== 'Not Required'`.
- _Location:_ `app/project/[projectId]/page.tsx`

**C24 Hook Firehose — SortableContenderCard**
Removed `useProjectSettings` from inside `SortableContenderCard` (rendered N times per opportunity). Disciplines and categories are now derived once in `ContendersMatrix` and passed as props.
- _Location:_ `ContendersMatrix.tsx`, `SortableContenderCard.tsx`

**Stale Category Dropdown Guard**
Category `<select>` now uses `.some()` instead of `.includes()` when checking if a saved value still exists in settings — previously saved categories remain visible even after being removed from project settings.
- _Location:_ `SortableContenderCard.tsx`

#### Internal / Architecture

| Item | Detail |
|------|--------|
| `CategoryConfig` interface | `types/models.ts` — `{id: string, label: string, no_coord_default: boolean}` |
| `normalizeCategories()` | `lib/normalizeSettings.ts` — Migrates legacy `string[]` to `CategoryConfig[]` at read-time, no DB migration required |
| `DEFAULT_CATEGORIES` | `lib/constants.ts` — Upgraded to `CategoryConfig[]` with stable prefixed IDs |
| `CoordinationDetailsMap` type | `types/models.ts` — Correctly types mixed JSONB: `{ is_escalated?: boolean } & Record<string, DisciplineDetails>` |
| Type guards | `CoordinationBoard.tsx`, `CoordinationTable.tsx` — Safe `.filter()` before accessing `.status` on discipline entries |

