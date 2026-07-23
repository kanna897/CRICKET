"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Award, BarChart3, GitBranch, History, ListOrdered, LogOut, Menu, Moon, PlayCircle, Scale, Settings, Sun, Trophy, UserCheck, UserPlus, Users, X } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { CrickpulseLogo } from "@/components/crickpulse-logo";
import { supabase } from "@/lib/supabase";
import { cn } from "@/utils/cn";
import { AdminGlobalSearch } from "@/components/admin-global-search";
import { useTranslations } from "next-intl";

const baseNavigation = [
  { name: "Dashboard", translationKey: "dashboard", href: "/admin", icon: BarChart3 },
  { name: "Tournaments", translationKey: "tournaments", href: "/admin/tournaments", icon: Trophy },
  { name: "Teams", translationKey: "teams", href: "/admin/teams", icon: Users },
  { name: "Players", translationKey: "players", href: "/admin/players", icon: UserPlus },
  { name: "Registrations", translationKey: "registrations", href: "/admin/player-registrations", icon: UserCheck },
  { name: "Matches & Scoring", translationKey: "matches", href: "/admin/matches", icon: PlayCircle },
  { name: "Knockout Bracket", translationKey: "bracket", href: "/admin/bracket", icon: GitBranch },
  { name: "Points Table", translationKey: "points", href: "/admin/points", icon: ListOrdered },
  { name: "Score Import", translationKey: "scoreImport", href: "/admin/score-import", icon: History },
  { name: "Statistics", translationKey: "statistics", href: "/admin/stats", icon: Activity },
  { name: "Compare", translationKey: "compare", href: "/admin/compare", icon: Scale },
  { name: "Awards", translationKey: "awards", href: "/admin/hall-of-fame", icon: Award },
  { name: "Settings", translationKey: "settings", href: "/admin/settings", icon: Settings },
];

type AdminAccess = { userId: string; role: "master_admin" | "organizer"; isMasterAdmin: boolean };
const AdminAccessContext = createContext<AdminAccess | null>(null);

export function useAdminAccess() {
  const value = useContext(AdminAccessContext);
  if (!value) throw new Error("useAdminAccess must be used inside the admin area");
  return value;
}

export function AdminShell({ children, displayName, role, userId }: { children: React.ReactNode; displayName: string; role: "master_admin" | "organizer"; userId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("Admin");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigation = role === "master_admin" ? [...baseNavigation, { name: "Organizers", translationKey: "organizers", href: "/admin/organizers", icon: Users }] : baseNavigation;
  const currentPathname = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  const locale = pathname.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || "en";

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <AdminAccessContext.Provider value={{ userId, role, isMasterAdmin: role === "master_admin" }}><div className="admin-theme-shell min-h-screen bg-background flex flex-col md:flex-row">
    {sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />}
    <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 md:translate-x-0 md:static md:flex-shrink-0 flex flex-col", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="h-20 flex items-center justify-between px-3 border-b border-border"><Link href={`/${locale}`} aria-label="Go to Crickpulse home" title="Go to public home" className="admin-logo-panel flex h-14 flex-1 items-center justify-center rounded-xl bg-white px-3 shadow-sm transition hover:ring-2 hover:ring-primary/40"><CrickpulseLogo className="h-12 w-full object-contain" /></Link><button onClick={() => setSidebarOpen(false)} className="ml-2 md:hidden" aria-label="Close navigation"><X className="w-5 h-5" /></button></div>
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">{navigation.map((item) => { const active = currentPathname === item.href || (currentPathname.startsWith(item.href) && item.href !== "/admin"); return <Link key={item.name} href={item.href} className={cn("group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors", active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted hover:text-primary")}><item.icon className="mr-3 h-5 w-5" />{t(item.translationKey)}</Link>; })}</nav>
    </aside>
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <header className="min-h-16 flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-card"><button onClick={() => setSidebarOpen(true)} className="md:hidden p-2" aria-label="Open navigation"><Menu className="w-5 h-5" /></button><AdminGlobalSearch /><div className="ml-auto flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-semibold">{displayName}</p><p className="text-xs text-muted-foreground">{role === "master_admin" ? "Master Admin" : "Organizer"}</p></div><button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="p-2 rounded-full hover:bg-muted" aria-label="Toggle theme">{resolvedTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button><button onClick={signOut} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button></div></header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">{children}</main>
    </div>
  </div></AdminAccessContext.Provider>;
}
