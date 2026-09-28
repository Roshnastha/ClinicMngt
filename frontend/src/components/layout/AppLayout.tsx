"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import {
  PageHeaderProvider,
} from "./page-header-context";

/**
 * App shell layout — persistent Sidebar + Header around the main content.
 * All sub-routes render inside <main> on the #F6F3EA app background.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <PageHeaderProvider>
      <div className="min-h-screen bg-bg-app">
        <Sidebar />
        <div className="ml-64 flex min-h-screen flex-col">
          <Header />
          <main className="flex-1 px-6 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
