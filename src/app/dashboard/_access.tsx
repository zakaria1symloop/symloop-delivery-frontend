"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMyAccess, type MyAccess } from "@/lib/roles";

interface AccessContextValue {
  access: MyAccess | null;
  loading: boolean;
  /**
   * True when the current user may see the given page (route href key).
   * Fails OPEN: while access is loading, or when there is no restriction
   * (admin / `pages === null`), every page is visible — so nav never breaks.
   */
  canSeePage: (pageKey: string) => boolean;
  /**
   * True when the current user holds the given permission.
   * Permissions are PRIVILEGES (opt-in): default DENY. Only admins, or a user
   * whose assigned role explicitly lists the key, hold it. No-role / loading → false.
   */
  hasPermission: (key: string) => boolean;
}

const AccessContext = createContext<AccessContextValue>({
  access: null,
  loading: true,
  canSeePage: () => true,
  hasPermission: () => false,
});

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<MyAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getMyAccess()
      .then((r) => {
        if (!alive) return;
        if (r.success && r.data) setAccess(r.data);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const canSeePage = useCallback(
    (pageKey: string): boolean => {
      // Not loaded yet → don't hide anything (avoid blank sidebar flash).
      if (!access) return true;
      if (access.is_admin) return true;
      // null === no restriction → see everything.
      if (access.pages == null) return true;
      return access.pages.includes(pageKey);
    },
    [access],
  );

  const hasPermission = useCallback(
    (key: string): boolean => {
      // Not loaded yet → withhold gated powers until we know.
      if (!access) return false;
      if (access.is_admin) return true;
      // Privileges are opt-in: a user only holds one if their assigned role
      // explicitly grants it. No role (permissions === null) → no privilege.
      if (!Array.isArray(access.permissions)) return false;
      return access.permissions.includes(key);
    },
    [access],
  );

  return (
    <AccessContext.Provider value={{ access, loading, canSeePage, hasPermission }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess(): AccessContextValue {
  return useContext(AccessContext);
}
