"use client";
import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SuccessHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Wait until component mounts to post message back to the parent iframe
    if (window.opener) {
      const returnTo = searchParams.get('returnTo') || '/dashboard';
      
      window.opener.postMessage(
        { type: 'PROCORE_AUTH_SUCCESS', returnTo },
        window.location.origin
      );
      
      // Close the popup
      window.close();
    } else {
      // Fallback if they navigated here manually without a popup
      window.location.href = searchParams.get('returnTo') || '/dashboard';
    }
  }, [searchParams]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
      <p className="text-slate-500 dark:text-slate-400 font-medium">
        Authentication successful! Redirecting...
      </p>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-slate-50 dark:bg-slate-950" />}>
      <SuccessHandler />
    </Suspense>
  );
}
