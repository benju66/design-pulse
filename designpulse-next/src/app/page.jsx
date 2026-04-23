import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function RootPage() {
  // Automatically send users to the dashboard when they visit the root URL
  redirect('/dashboard');
}
