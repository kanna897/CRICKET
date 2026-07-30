"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ListOrdered, Radio, Users } from "lucide-react";
import { cn } from "@/utils/cn";

const items = [
  { label: "Home", href: "/", icon: Home, match: (path: string) => path === "/" },
  { label: "Matches", href: "/fixtures", icon: Radio, match: (path: string) => path === "/fixtures" || path.startsWith("/match/") },
  { label: "Points", href: "/points", icon: ListOrdered, match: (path: string) => path === "/points" },
  { label: "Teams", href: "/teams", icon: Users, match: (path: string) => path === "/teams" || path.startsWith("/teams/") },
  { label: "Explore", href: "/discover", icon: LayoutGrid, match: (path: string) => ["/discover", "/tournaments", "/stats", "/rankings", "/hall-of-fame", "/compare", "/login"].some((value) => path === value || path.startsWith(`${value}/`)) },
];

export function PublicMobileNav() {
  const pathname = usePathname();
  const localeMatch = pathname.match(/^\/(en|ta|si)(?=\/|$)/);
  const locale = localeMatch?.[1] || "en";
  const currentPath = pathname.replace(/^\/(en|ta|si)(?=\/|$)/, "") || "/";

  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-700/80 bg-[#071427]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-slate-300 shadow-[0_-12px_30px_rgba(2,8,23,0.28)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const active = item.match(currentPath);
          const Icon = item.icon;
          return <Link key={item.label} href={`/${locale}${item.href === "/" ? "" : item.href}`} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.68rem] font-bold transition", active ? "bg-emerald-500/20 text-emerald-300" : "hover:bg-white/5 hover:text-white")}><Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} /><span>{item.label}</span></Link>;
        })}
      </div>
    </nav>
  );
}
