# Design Pulse

## 1. Project Overview

Design Pulse is an enterprise-grade Pre-Construction Decision Engine and Design Coordination Tracker designed specifically for commercial construction. It bridges the gap between pre-construction estimates and architectural execution by transforming static, disconnected spreadsheets into an interactive, spatial, and auditable state-machine. 

By centralizing Value Engineering (VE) data and design updates into a single source of truth, Design Pulse eliminates "decision amnesia" and ensures that approved financial options seamlessly translate into actionable design coordination pipelines.

## 2. Core Features

- **Tri-State Master-Detail Grid:** A high-performance Value Engineering matrix featuring an Excel-like keyboard navigation experience. Supports flat dense tables, split detail panels, and pop-out isolated views for rapid data entry and evaluation.
- **Design Coordination Tracker:** A drag-and-drop Kanban pipeline for managing architectural and MEP drawing updates directly downstream from locked financial decisions.
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
