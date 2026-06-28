"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Map,
  Building2,
  MapPin,
  Store,
  Globe,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Package2,
  Users,
  PackagePlus,
  Boxes,
  Banknote,
  Receipt,
  ScanBarcode,
  UserCheck,
  Archive,
  Truck,
  RotateCcw,
  Wallet,
  UserPlus,
  Settings2,
  CarFront,
  ClipboardList,
  Upload,
  BarChart3,
  FileBarChart,
  ArrowUpRight,
  TrendingUp,
  Code2,
  Contact,
  MessageSquareWarning,
  Target,
  KeyRound,
  Workflow,
  ShieldCheck,
  History,
  Bell,
  Coins,
  Percent,
  Bike,
  Route,
  HandCoins,
  Activity,
} from "lucide-react";
import { useAccess } from "../_access";

function getNavSections(userType?: string) {
  const isAdmin = !userType || userType === "admin";
  const isOperator = userType === "operator" || userType === "responsable";

  // Expéditeur gets their own dedicated nav
  if (userType === "expediteur") {
    return [
      { label: "Principal", items: [
        { label: "Tableau de bord", href: "/dashboard/expediteur", icon: LayoutDashboard },
      ]},
      { label: "Colis", items: [
        { label: "Colis", icon: Boxes, children: [
          { label: "Nouveau Colis", href: "/dashboard/expediteur/nouveau", icon: PackagePlus },
          { label: "Import CSV", href: "/dashboard/expediteur/import", icon: Upload },
          { label: "Mes Colis", href: "/dashboard/expediteur/colis", icon: Boxes },
        ]},
      ]},
      { label: "Catalogue", items: [
        { label: "Mes Produits", href: "/dashboard/expediteur/produits", icon: Package2 },
        { label: "Boutique en ligne", href: "/dashboard/ecommerce", icon: Globe },
      ]},
      { label: "Clients", items: [
        { label: "Mes Clients", href: "/dashboard/expediteur/clients", icon: Contact },
        { label: "CRM", href: "/dashboard/expediteur/crm", icon: Target },
      ]},
      { label: "Analyses", items: [
        { label: "Statistiques", href: "/dashboard/expediteur/stats", icon: BarChart3 },
      ]},
      { label: "Finance", items: [
        { label: "Mon Portefeuille", href: "/dashboard/expediteur/wallet", icon: Wallet },
        { label: "Réclamations", href: "/dashboard/expediteur/reclamations", icon: MessageSquareWarning },
      ]},
      { label: "Compte", items: [
        { label: "Mes Utilisateurs", href: "/dashboard/expediteur/utilisateurs", icon: Users },
      ]},
    ];
  }

  const sections: NavSection[] = [];

  // Principal
  sections.push({
    label: "Principal",
    items: [
      { label: "Tableau de bord", href: isAdmin ? "/dashboard/admin" : "/dashboard/operator", icon: LayoutDashboard },
    ],
  });

  // Utilisateurs — admin sees all, operator sees only for drivers/clients
  sections.push({
    label: "Utilisateurs",
    items: [
      { label: "Utilisateurs", href: "/dashboard/users", icon: Users },
    ],
  });

  // Scan — everyone sees (colis + sac), SD-scoped on backend
  sections.push({
    label: "Scan",
    items: [
      {
        label: "Scan",
        icon: ScanBarcode,
        children: [
          { label: "Scanner Colis", href: "/dashboard/scan/colis", icon: Package2 },
          { label: "Scanner Sac",   href: "/dashboard/scan/sac",   icon: Archive  },
        ],
      },
    ],
  });

  // Colis — everyone sees this
  sections.push({
    label: "Colis",
    items: [
      {
        label: "Colis",
        icon: Boxes,
        children: [
          { label: "Nouveau Colis (POS)", href: "/dashboard/colis/pos",   icon: PackagePlus  },
          { label: "Gestion des Colis",   href: "/dashboard/colis",       icon: Boxes        },
          { label: "Retrait Client",      href: "/dashboard/retrait",     icon: UserCheck    },
          { label: "Retours",             href: "/dashboard/retour",      icon: RotateCcw    },
        ],
      },
    ],
  });

  // Expéditeurs — everyone sees
  sections.push({
    label: "Expéditeurs",
    items: [
      {
        label: "Expéditeurs",
        icon: UserPlus,
        children: [
          { label: "Gestion",          href: "/dashboard/expediteurs",           icon: UserPlus    },
          { label: "Scan Réception",    href: "/dashboard/scan",                 icon: ScanBarcode },
          { label: "Finances",          href: "/dashboard/expediteurs/finances",  icon: Wallet     },
          { label: "Retrait Retours",   href: "/dashboard/expediteurs/retours",  icon: RotateCcw  },
        ],
      },
    ],
  });

  // Commercial — CRM + Réclamations
  sections.push({
    label: "Commercial",
    items: [
      { label: "CRM",          href: "/dashboard/crm",          icon: Contact },
      { label: "Réclamations", href: "/dashboard/reclamations", icon: MessageSquareWarning },
    ],
  });

  // Logistique — everyone sees (operator sees only their SD's bags)
  sections.push({
    label: "Logistique",
    items: [
      {
        label: "Logistique",
        icon: Truck,
        children: [
          { label: "Gestion des Sacs",    href: "/dashboard/sacs",            icon: Archive      },
          { label: "En passage",          href: "/dashboard/sacs?filter=passage", icon: ArrowUpRight },
          { label: "Navettes",            href: "/dashboard/navettes",        icon: Truck        },
        ],
      },
    ],
  });


  // Livreurs — admin + operator
  sections.push({
    label: "Livreurs",
    items: [
      {
        label: "Livreurs",
        icon: CarFront,
        children: [
          { label: "Liste Livreurs",    href: "/dashboard/chauffeurs/liste",        icon: CarFront      },
          { label: "Attribution",       href: "/dashboard/chauffeurs/attribution",  icon: ScanBarcode   },
          { label: "Ramassage",         href: "/dashboard/chauffeurs/ramassage",   icon: PackagePlus   },
          { label: "Collection",        href: "/dashboard/chauffeurs/collection",   icon: Banknote      },
          { label: "Suivi",             href: "/dashboard/chauffeurs/suivi",        icon: ClipboardList },
        ],
      },
    ],
  });

  // Géographie — admin only
  if (isAdmin) {
    sections.push({
      label: "Géographie",
      items: [
        {
          label: "Géographie",
          icon: Map,
          children: [
            { label: "Wilaya",    href: "/dashboard/geography/wilaya",    icon: Building2 },
            { label: "Commune",   href: "/dashboard/geography/commune",   icon: MapPin    },
            { label: "Stop Desk", href: "/dashboard/geography/stop-desk", icon: Store     },
            { label: "Carte",     href: "/dashboard/geography/map",       icon: Globe     },
          ],
        },
      ],
    });
  }

  // Rapports — analytics & reports (admin + operator), gated by canSeePage.
  // Expandable group: first child is the hub, then the 15 dedicated reports.
  sections.push({
    label: "Analyses",
    items: [
      {
        label: "Rapports",
        icon: FileBarChart,
        children: [
          { label: "Tous les rapports",       href: "/dashboard/rapports",              icon: FileBarChart },
          { label: "Vue d'ensemble",          href: "/dashboard/rapports/overview",     icon: LayoutDashboard },
          { label: "Colis",                   href: "/dashboard/rapports/colis",        icon: Boxes },
          { label: "Performance Livraison",   href: "/dashboard/rapports/livraison",    icon: Truck },
          { label: "Retours",                 href: "/dashboard/rapports/retours",      icon: RotateCcw },
          { label: "Financier Global",        href: "/dashboard/rapports/finance",      icon: Wallet },
          { label: "Caisses",                 href: "/dashboard/rapports/caisses",      icon: Coins },
          { label: "Prélèvements",            href: "/dashboard/rapports/prelevements", icon: Percent },
          { label: "Stop Desk",               href: "/dashboard/rapports/stop-desks",   icon: Building2 },
          { label: "Chauffeurs",              href: "/dashboard/rapports/chauffeurs",   icon: Bike },
          { label: "Expéditeurs",             href: "/dashboard/rapports/expediteurs",  icon: Store },
          { label: "Géographique",            href: "/dashboard/rapports/geographie",   icon: MapPin },
          { label: "Navettes",                href: "/dashboard/rapports/navettes",     icon: Route },
          { label: "Réclamations",            href: "/dashboard/rapports/reclamations", icon: MessageSquareWarning },
          { label: "COD / Recouvrement",      href: "/dashboard/rapports/cod",          icon: HandCoins },
          { label: "Activité / Audit",        href: "/dashboard/rapports/activite",     icon: Activity },
        ],
      },
    ],
  });

  // Finance — admin sees all, operator sees only Caisse
  sections.push({
    label: "Finance",
    items: [
      {
        label: "Finance",
        icon: Banknote,
        children: isAdmin
          ? [
              { label: "Caisse",            href: "/dashboard/caisse",            icon: Banknote   },
              { label: "Situation SDs",     href: "/dashboard/finance/situation", icon: Receipt    },
              { label: "Profit par Colis",  href: "/dashboard/finance/profit",    icon: TrendingUp },
              { label: "Tarification",      href: "/dashboard/tarification",      icon: Receipt    },
            ]
          : [
              { label: "Caisse",            href: "/dashboard/caisse",            icon: Banknote   },
              { label: "Situation Admin",   href: "/dashboard/finance/situation", icon: Receipt    },
              { label: "Profit par Colis",  href: "/dashboard/finance/profit",    icon: TrendingUp },
            ],
      },
    ],
  });

  // Admin — SD Financial Config (margins, prélèvement)
  if (isAdmin) {
    sections.push({
      label: "Administration",
      items: [
        {
          label: "Administration",
          icon: Settings2,
          children: [
            { label: "Config SD",        href: "/dashboard/admin/sd-config",  icon: Settings2  },
            { label: "Workflow statuts", href: "/dashboard/admin/workflow",   icon: Workflow   },
            { label: "Notifications",    href: "/dashboard/admin/notifications", icon: Bell    },
            { label: "Rôles",            href: "/dashboard/admin/roles",      icon: ShieldCheck },
            { label: "Clés API",         href: "/dashboard/admin/api-keys",   icon: KeyRound   },
            { label: "Journal d'activité", href: "/dashboard/admin/activity-logs", icon: History },
          ],
        },
      ],
    });
  }

  return sections;
}

// Type helper for navSections
type NavChild = { label: string; href: string; icon: typeof LayoutDashboard };
type NavItem = { label: string; href?: string; icon: typeof LayoutDashboard; children?: NavChild[] };
type NavSection = { label: string; items: NavItem[] };
const allSections: NavSection[] = [];
type NavSections = NavSection[];

/** Strip any query string so the href matches the backend page-registry key. */
function pageKey(href: string): string {
  return href.split("?")[0];
}

/**
 * Filter nav by the access provider's `canSeePage`. Group items keep only the
 * children the user may see, and empty groups/sections are dropped. `canSeePage`
 * fails open (admins + unrestricted users see everything), so this is a no-op
 * unless a custom role with a restricted page-list is assigned.
 */
function filterSections(sections: NavSection[], canSeePage: (k: string) => boolean): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) =>
          item.children
            ? { ...item, children: item.children.filter((c) => canSeePage(pageKey(c.href))) }
            : item,
        )
        .filter((item) =>
          item.children ? item.children.length > 0 : item.href ? canSeePage(pageKey(item.href)) : true,
        ),
    }))
    .filter((section) => section.items.length > 0);
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  user?: { first_name: string; last_name: string; user_type: string; api_enabled?: boolean } | null;
}

const roleColors: Record<string, string> = {
  admin:             "bg-blue-500/15 text-blue-500",
  operator:          "bg-amber-500/15 text-amber-500",
  responsable:       "bg-emerald-500/15 text-emerald-500",
  expediteur:        "bg-rose-500/15 text-rose-500",
  chauffeur:         "bg-sky-500/15 text-sky-500",
  transit_chauffeur: "bg-indigo-500/15 text-indigo-500",
};

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose, user }: Props) {
  const pathname = usePathname();
  const { canSeePage } = useAccess();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Colis: true, Logistique: true, Géographie: true, Finance: true });

  function toggleGroup(label: string) {
    setOpenGroups((p) => ({ ...p, [label]: !p[label] }));
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : "?";

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={cn(
          "flex flex-col h-screen sticky top-0 shrink-0 z-50 overflow-hidden",
          "transition-[width] duration-200 ease-in-out",
          "fixed md:relative",
          mobileOpen ? "left-0" : "-left-full md:left-auto",
          collapsed ? "w-[60px]" : "w-[240px]",
          /* Light mode */
          "bg-[#fafafa] border-r border-[#e8e8ec]",
          /* Dark mode */
          "dark:bg-[#0e1017] dark:border-[#1e2130]",
        )}
      >
        {/* ── Brand ── */}
        <div
          className={cn(
            "h-[60px] flex items-center shrink-0 border-b",
            "border-[#e8e8ec] dark:border-[#1e2130]",
            collapsed ? "justify-center px-0" : "px-4 gap-3",
          )}
        >
          {collapsed ? (
            <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(249,115,22,0.4)]">
              <span className="text-white font-extrabold text-[16px] leading-none">S</span>
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col justify-center leading-none">
                <span className="font-extrabold text-[19px] tracking-tight text-[#111827] dark:text-[#f5f5f5]">
                  Sym<span className="text-orange-500">loop</span>
                </span>
                <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.32em] text-[#a1a1aa] dark:text-[#52525b]">
                  logistique
                </span>
              </div>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/8"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {filterSections(getNavSections(user?.user_type), canSeePage).map((section) => (
            <div key={section.label}>
              {/* Section label */}
              {!collapsed && (
                <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a1a1aa] dark:text-[#52525b]">
                  {section.label}
                </p>
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  /* Single link */
                  if ("href" in item && item.href) {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onMobileClose}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 relative group",
                          collapsed ? "h-9 w-9 mx-auto justify-center" : "px-2.5 py-2",
                          active
                            ? "bg-orange-500/10 text-orange-500 dark:bg-orange-500/15"
                            : "text-[#52525b] dark:text-[#a0a0ab] hover:bg-black/5 dark:hover:bg-white/6 hover:text-[#111827] dark:hover:text-[#f5f5f5]",
                        )}
                      >
                        {active && !collapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-orange-500 rounded-full" />
                        )}
                        <item.icon className={cn("w-4 h-4 shrink-0", active && "text-orange-500")} />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  }

                  /* Group with children */
                  const open = openGroups[item.label] ?? false;
                  const groupActive = "children" in item && item.children?.some((c) => isActive(c.href)) || false;

                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => !collapsed && toggleGroup(item.label)}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 w-full",
                          collapsed ? "h-9 w-9 mx-auto justify-center" : "px-2.5 py-2",
                          groupActive
                            ? "text-[#111827] dark:text-[#f5f5f5]"
                            : "text-[#52525b] dark:text-[#a0a0ab] hover:bg-black/5 dark:hover:bg-white/6 hover:text-[#111827] dark:hover:text-[#f5f5f5]",
                        )}
                      >
                        <item.icon className={cn("w-4 h-4 shrink-0", groupActive && "text-orange-500")} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronDown
                              className={cn(
                                "w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-150",
                                open && "rotate-180",
                              )}
                            />
                          </>
                        )}
                      </button>

                      {/* Expanded children */}
                      {!collapsed && open && "children" in item && item.children?.map((child) => {
                        const active = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onMobileClose}
                            className={cn(
                              "flex items-center gap-2 pl-8 pr-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 relative",
                              active
                                ? "bg-orange-500/10 text-orange-500 dark:bg-orange-500/15"
                                : "text-[#71717a] dark:text-[#71717a] hover:bg-black/5 dark:hover:bg-white/6 hover:text-foreground",
                            )}
                          >
                            {active && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-orange-500 rounded-full" />
                            )}
                            <child.icon className="w-3.5 h-3.5 shrink-0" />
                            {child.label}
                          </Link>
                        );
                      })}

                      {/* Collapsed children */}
                      {collapsed && "children" in item && item.children?.map((child) => {
                        const active = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onMobileClose}
                            title={child.label}
                            className={cn(
                              "flex items-center justify-center h-8 w-9 mx-auto rounded-lg transition-colors",
                              active
                                ? "bg-orange-500/10 text-orange-500"
                                : "text-[#71717a] hover:bg-black/5 dark:hover:bg-white/6 hover:text-foreground",
                            )}
                          >
                            <child.icon className="w-3.5 h-3.5" />
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Sticky resources (expéditeur) ── */}
        {user?.user_type === "expediteur" && (
          <div className="shrink-0 border-t border-[#e8e8ec] dark:border-[#1e2130] px-2 py-2 space-y-0.5">
            {!collapsed && (
              <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a1a1aa] dark:text-[#52525b]">
                Ressources
              </p>
            )}
            {[
              { label: "API REST",    href: "/dashboard/expediteur/api",     icon: Code2 },
              { label: "Tarifs",      href: "/dashboard/expediteur/tarifs",   icon: Receipt },
              { label: "Nos Bureaux", href: "/dashboard/expediteur/bureaux",  icon: Building2 },
            ]
            // "API REST" is a gateable registry page (/dashboard/expediteur/api):
            // hide/show it per the role's granted pages (same as the main nav) AND
            // per this merchant's `api_enabled` flag — a disabled merchant never sees
            // it. `api_enabled !== false` so legacy users (flag absent) still see it.
            // Non-gateable resources (Tarifs, Nos Bureaux) always show.
            .filter((item) =>
              item.href === "/dashboard/expediteur/api"
                ? canSeePage(pageKey(item.href)) && user?.api_enabled !== false
                : true,
            )
            .map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 relative",
                    collapsed ? "h-9 w-9 mx-auto justify-center" : "px-2.5 py-2",
                    active
                      ? "bg-orange-500/10 text-orange-500 dark:bg-orange-500/15"
                      : "text-[#52525b] dark:text-[#a0a0ab] hover:bg-black/5 dark:hover:bg-white/6 hover:text-[#111827] dark:hover:text-[#f5f5f5]",
                  )}
                >
                  {active && !collapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-orange-500 rounded-full" />
                  )}
                  <item.icon className={cn("w-4 h-4 shrink-0", active && "text-orange-500")} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}

        {/* ── User profile ── */}
        {user && (
          <div
            className={cn(
              "shrink-0 border-t p-3",
              "border-[#e8e8ec] dark:border-[#1e2130]",
            )}
          >
            {collapsed ? (
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-orange-500">{initials}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-orange-500">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#111827] dark:text-[#f5f5f5] truncate leading-tight">
                    {user.first_name} {user.last_name}
                  </p>
                  <span className={cn(
                    "text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded-md",
                    roleColors[user.user_type] ?? "bg-[#f1f5f9] text-[#64748b] dark:bg-[#1e2130] dark:text-[#6b7280]",
                  )}>
                    {user.user_type}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapsed expand trigger */}
        {collapsed && (
          <div className="p-2 border-t border-[#e8e8ec] dark:border-[#1e2130]">
            <button
              onClick={onToggle}
              className="w-full flex items-center justify-center h-9 rounded-lg text-[#9ca3af] dark:text-[#52525b] hover:text-[#111827] dark:hover:text-[#f5f5f5] hover:bg-black/5 dark:hover:bg-white/6 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
