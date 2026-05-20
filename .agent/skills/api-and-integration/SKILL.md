# API and Integration Skill

This skill applies when you are modifying Next.js API Routes, Python FastAPI microservices, or building cross-system data integrations.

## Backend Separation of Concerns
* **Next.js API Routes (`/api/...`):** Strictly reserved for Authentication flows (e.g., Supabase native Email/Password Auth, Procore OAuth). Do NOT build general data CRUD endpoints here.
* **Security & Auth Queries:** The frontend CANNOT directly query the Supabase `auth.users` schema. You must use `SECURITY DEFINER` RPCs (like `get_system_users()`) to securely bridge authentication data into the public schema without leaking sensitive user metadata. Furthermore, if creating an RPC intended exclusively for backend API routes (like `get_user_id_by_email()`), you MUST explicitly `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, authenticated, anon;` and `GRANT EXECUTE ... TO service_role;` to prevent user enumeration vulnerabilities.
* **Python FastAPI Backend:** Strictly dedicated to heavy processing tasks (PyMuPDF file conversions, vector extraction via Shapely). Do NOT use this for basic CRUD operations.
* **Python API Proxy Routing:** All frontend-to-Python API calls MUST be routed through the Next.js rewrite proxy using the `/py-api/` path (via the `API_BASE_URL` exported from `services/api.ts`). NEVER hardcode direct local IPs (like `http://127.0.0.1:8000`) in components, as this causes CORS and Mixed Content failures when accessing the app through secure `ngrok` tunnels.
* **Data Fetching:** Standard CRUD operations must be handled directly from the frontend using the `@supabase/supabase-js` client protected by RLS.

## Code Generation Instructions
5.  **Analytics & Aggregation:** Heavy data aggregation (e.g., ROI distribution, bottleneck counts, heatmap variances) MUST be offloaded to PostgreSQL RPC stored procedures rather than calculating via `useMemo` on the client thread. Consume these RPCs via TanStack `useQuery`.
20. **API Gateway Protection (Payload Chunking):** When executing bulk mutations from the frontend (like importing hundreds of rows), you MUST chunk the payload into smaller batches (e.g., 50-100 rows) via `Promise.all` in the TanStack Query hook to prevent Kong API Gateway timeouts and browser memory exhaustion.
41. **PyMuPDF Coordinate Normalization (Canvas/Backend Parity):** When passing frontend canvas bounding boxes (pixels) to the Python backend for `PyMuPDF` text extraction, you MUST strictly account for the PDF's internal `page.rotation` and apply exact scaling ratios. Failing to apply derotation matrices will cause the extraction engine to grab the wrong text on architectural sheets that were rotated by the original author.
42. **Heavy Processing Offloading (Kong Gateway Safety):** When processing massive multi-page architectural PDFs, the FastAPI endpoint MUST NOT block the main HTTP response loop. You must utilize `asyncio.create_task` or FastAPI `BackgroundTasks` to process the file and generate DeepZoom tiles asynchronously. Synchronous processing will trigger Kong API Gateway timeouts and crash the frontend upload flow.

## Architectural Organization & File Structure
4. **FastAPI Backend Modularity:** The Python backend MUST NOT house all endpoints and logic in `main.py`. You must use `APIRouter` to split endpoints by domain (e.g., `routers/pdf.py`). Furthermore, heavy synchronous processing (like `PyMuPDF`/`fitz` operations) MUST be extracted into a `services/` layer to keep route handlers thin and readable.
