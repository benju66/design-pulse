export const dynamic = 'force-dynamic';

export default function RootPage() {
  // The redirect to /dashboard is now handled at the Next.js config level (next.config.mjs)
  // to avoid performance measurement errors during React rendering in dev mode.
  return null;
}
