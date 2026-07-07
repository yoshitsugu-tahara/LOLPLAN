"use client";

import { SessionProvider } from "next-auth/react";

import ConfirmProvider from "./ConfirmDialog";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </SessionProvider>
  );
}
