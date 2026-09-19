"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider } from "@/lib/theme";
import { WaniKaniApiError } from "@/lib/wanikani/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Public fragments never need account lookups or stored account preferences.
  if (pathname === "/shared-progress" || pathname === "/shared-progress/") return children;
  return <ApplicationProviders>{children}</ApplicationProviders>;
}

function ApplicationProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        retry: (failureCount, error) => !(error instanceof WaniKaniApiError && [400, 401, 403, 404, 422, 429].includes(error.status)) && failureCount < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider><SessionProvider>{children}</SessionProvider></ThemeProvider>
    </QueryClientProvider>
  );
}
