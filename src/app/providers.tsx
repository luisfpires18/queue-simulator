"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ChatDockProvider } from "@/components/network/ChatDockContext";
import { ChatDock } from "@/components/network/ChatDock";

export function Providers({ children, currentUserId }: { children: React.ReactNode; currentUserId?: string }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false } } })
  );
  return (
    <QueryClientProvider client={client}>
      <ChatDockProvider currentUserId={currentUserId}>
        {children}
        <ChatDock />
      </ChatDockProvider>
    </QueryClientProvider>
  );
}
