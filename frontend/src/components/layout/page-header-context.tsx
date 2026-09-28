"use client";

/**
 * Page-header context — lets each page declare its title (rendered in
 * Fraunces in the top bar) and optional primary action button(s) without
 * prop-drilling through the layout.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface PageHeaderConfig {
  title: string;
  /** Optional primary CTA(s), e.g. "+ Add Patient". */
  actions?: ReactNode;
}

interface PageHeaderContextValue {
  header: PageHeaderConfig | null;
  setPageHeader: (config: PageHeaderConfig | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PageHeaderConfig | null>(null);

  const setPageHeader = useCallback((config: PageHeaderConfig | null) => {
    setHeaderState(config);
  }, []);

  const value = useMemo(
    () => ({ header, setPageHeader }),
    [header, setPageHeader],
  );

  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
}

/**
 * Declarative hook: sets the top-bar title/actions while mounted.
 * Pass `null` to reset (e.g. on unmount cleanup).
 */
export function usePageHeader(config: PageHeaderConfig | null) {
  const ctx = useContext(PageHeaderContext);
  const setPageHeader = ctx?.setPageHeader;

  // Keep the latest actions in a ref so inline JSX (new element identity on
  // every render) doesn't re-trigger the effect and cause update loops.
  const actionsRef = useRef<ReactNode>(config?.actions);
  actionsRef.current = config?.actions;

  const title = config?.title ?? null;

  useEffect(() => {
    if (!setPageHeader) return;
    if (title === null) {
      setPageHeader(null);
    } else {
      setPageHeader({ title, actions: actionsRef.current });
    }
    return () => setPageHeader(null);
  }, [title, setPageHeader]);
}

export function usePageHeaderContext(): PageHeaderContextValue {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error("usePageHeaderContext must be used inside <PageHeaderProvider>");
  }
  return ctx;
}
