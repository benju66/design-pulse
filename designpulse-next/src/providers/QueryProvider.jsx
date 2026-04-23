"use client";

import { QueryClient, MutationCache, defaultShouldDehydrateMutation } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { persister } from '@/utils/persister';
import { supabase } from '@/supabaseClient';

export default function QueryProvider({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache(),
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            networkMode: 'offlineFirst', // Allows reading cache while offline
          },
          mutations: {
            networkMode: 'offlineFirst', // Queues mutations when offline
            retry: 3,
          }
        },
      })
  );

  useEffect(() => {
    // TODO: Rewrite listener to listen to the new opportunities table
  }, [queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ 
        persister,
        dehydrateOptions: {
          shouldDehydrateMutation: (mutation) => {
            return defaultShouldDehydrateMutation(mutation) || mutation.state.isPaused;
          },
        },
      }}
    >
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  );
}
