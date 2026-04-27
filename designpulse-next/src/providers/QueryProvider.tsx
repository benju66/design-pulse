"use client";

import { QueryClient, MutationCache } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/supabaseClient';


export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache(),
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
          },
          mutations: {
            retry: 3,
          }
        },
      })
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const debouncedInvalidate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['opportunities'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['all_project_options'], refetchType: 'active' });
      }, 300);
    };

    const channel = supabase.channel('public:opportunities_and_options')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunities' }, () => {
        debouncedInvalidate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunity_options' }, () => {
        debouncedInvalidate();
      })
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
