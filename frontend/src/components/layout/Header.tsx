"use client";

import { usePageHeaderContext } from "./page-header-context";

/**
 * Header / Top bar — sits above the main content on the #F6F3EA app
 * background. Renders the current page's title in Fraunces and optional
 * primary action button(s) declared via usePageHeader().
 */
export function Header() {
  const { header } = usePageHeaderContext();

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border-custom/70 px-6 py-4 md:px-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
        {header?.title ?? ""}
      </h1>
      {header?.actions ? (
        <div className="flex flex-wrap items-center gap-2">{header.actions}</div>
      ) : null}
    </header>
  );
}
