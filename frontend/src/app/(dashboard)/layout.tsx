import type { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";

/**
 * Route-group layout: every page under (dashboard) renders inside the
 * persistent app shell (Sidebar + Header) on the app background.
 */
export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
