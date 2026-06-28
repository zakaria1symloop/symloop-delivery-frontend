"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { logout, me, clearAuth, getStoredUser, reportClientError, type User } from "@/lib/api";
import { LogOut, Menu, Sun, Moon, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import Sidebar from "./_components/Sidebar";
import { AccessProvider } from "./_access";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "Mode clair" : "Mode sombre"}
      className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-black/6 dark:hover:bg-white/8",
      )}
    >
      {dark
        ? <Sun className="w-4 h-4" />
        : <Moon className="w-4 h-4" />}
    </button>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser]             = useState<User | null>(null);
  const [checking, setChecking]     = useState(true);
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function init() {
      const stored = getStoredUser();
      if (stored) { setUser(stored); setChecking(false); return; }
      const res = await me();
      if (res.success && res.data) {
        setUser(res.data.user);
      } else {
        clearAuth();
        router.replace("/login");
      }
      setChecking(false);
    }
    init();
  }, [router]);

  // Capture uncaught errors / rejected promises and ship them to the log file.
  // reportClientError is fire-and-forget and guards against logging loops.
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      reportClientError({
        message: e.message || "window.onerror",
        url: e.filename || (typeof window !== "undefined" ? window.location.pathname : undefined),
        stack: e.error instanceof Error ? e.error.stack : undefined,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      reportClientError({
        message: reason instanceof Error ? reason.message : String(reason ?? "unhandledrejection"),
        url: typeof window !== "undefined" ? window.location.pathname : undefined,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  }

  if (checking || !user) {
    return (
      <div className={cn(jakarta.variable, "min-h-screen bg-background flex items-center justify-center")}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:0ms]" />
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:150ms]" />
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();

  return (
    <AccessProvider>
    <div
      className={cn(
        jakarta.variable,
        "flex h-screen overflow-hidden bg-background text-foreground",
        "font-[family-name:var(--font-jakarta)]",
      )}
    >
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((p) => !p)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        user={user}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* ── Header ── */}
        <header
          className={cn(
            "h-[60px] flex items-center justify-between px-5 shrink-0 sticky top-0 z-40",
            "bg-background/95 backdrop-blur-md border-b",
            "border-[#e8e8ec] dark:border-[#1e2130]",
          )}
        >
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/6 dark:hover:bg-white/8 transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5">
            {/* Notification bell */}
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/6 dark:hover:bg-white/8 transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-orange-500" />
            </button>

            <ThemeToggle />

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1" />

            {/* Location badge */}
            {(() => {
              const sd = user.stop_desk;
              const parts = [
                sd?.name,
                sd?.commune?.name,
                sd?.commune?.wilaya?.name ?? (user as any)?.wilaya?.name,
              ].filter(Boolean);
              return parts.length > 0 ? (
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-blue-500 bg-blue-500/8 px-2.5 py-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {parts.join(" · ")}
                </span>
              ) : null;
            })()}

            {/* User avatar */}
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-[13px] font-semibold text-foreground leading-tight">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-[11px] text-muted-foreground capitalize">{user.user_type}</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(249,115,22,0.35)]">
                <span className="text-[11px] font-bold text-white">{initials}</span>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                title="Déconnexion"
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  "text-muted-foreground hover:text-red-500 hover:bg-red-500/10",
                  loggingOut && "opacity-40 pointer-events-none",
                )}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </main>
      </div>
      {/* Global keyframes — defined once, used by all pages */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideInR { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
    </AccessProvider>
  );
}
