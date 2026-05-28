# ⚠️ DEPRECATED — designpulse-map-module

**Status:** Deprecated as of 2026-05-28
**Superseded by:** `designpulse-next/src/components/drawings/` + `designpulse-backend/routers/drawings.py`

## What This Was

This directory contained a standalone prototype of the Map Module — a self-contained
React + Zustand + react-konva application for viewing and marking up construction
floor plans. It was developed as a proof-of-concept before the module was integrated
into the main `designpulse-next` application.

## Why It's Deprecated

The Map Module has been fully rebuilt inside the main application:

- **Frontend:** `designpulse-next/src/components/drawings/` (FloorplanCanvas, DrawingGrid, etc.)
- **Backend:** `designpulse-backend/routers/drawings.py` (UOPM pipeline, attach-original, etc.)
- **Database:** `project_drawing_sets`, `project_sheets`, `sheet_markups` tables in `supabase_schema.sql`

This prototype is preserved for historical reference only. It shares no imports with
the main application and can be safely ignored.

## Do NOT

- Import from this directory into `designpulse-next` or `designpulse-backend`
- Add new features here — all development happens in the main application
- Use this as a reference for current API contracts — the endpoints have diverged
