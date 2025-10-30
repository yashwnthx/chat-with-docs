"use client";

import { SimpleChatInterface } from "@/components/SimpleChatInterface";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Home() {
  return (
    <ErrorBoundary>
      <SimpleChatInterface />
    </ErrorBoundary>
  );
}
