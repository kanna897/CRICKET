"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CrickpulseLogo } from "@/components/crickpulse-logo";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const publicLinks = [{ href: "/fixtures", label: "Fixtures" }, { href: "/tournaments", label: "Tournaments" }, { href: "/points", label: "Points" }, { href: "/stats", label: "Stats" }, { href: "/hall-of-fame", label: "Awards" }, { href: "/teams", label: "Teams" }, { href: "/compare", label: "Compare" }];

export function PublicNav() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const localeMatch = pathname.match(/^\/(en|ta|si)(?=\/|$)/);
  const locale = localeMatch?.[1] || "en";
  const isHomePage = /^\/(en|ta|si)$/.test(pathname);

  return <header className="public-stadium-nav sticky top-0 z-40 border-b shadow-sm backdrop-blur-xl"><div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:min-h-[4.5rem] sm:flex-nowrap sm:px-6"><Link href={`/${locale}`} aria-label="Crickpulse home" style={{ backgroundColor: "#ffffff" }} className="isolate inline-flex rounded-xl border border-slate-200 !bg-white px-3 py-1.5 shadow-md transition hover:opacity-90"><CrickpulseLogo className="h-9 w-32 object-contain sm:h-10 sm:w-36" /></Link>{!isHomePage && <nav className="order-3 flex w-full items-center justify-between gap-1 overflow-x-auto text-xs font-extrabold tracking-wide sm:order-none sm:w-auto sm:justify-start sm:gap-2 sm:text-sm">{publicLinks.map((item) => <Link key={item.href} href={`/${locale}${item.href}`} className={`whitespace-nowrap rounded-lg px-2.5 py-2 transition hover:bg-sky-500/10 hover:text-sky-500 sm:px-3 ${pathname.includes(item.href) ? "bg-sky-500/10 text-sky-500" : ""}`}>{item.label}</Link>)}</nav>}<button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle day and night stadium" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-current/20 bg-white/10 shadow-sm backdrop-blur-xl">{resolvedTheme === "dark" ? <Sun className="h-5 w-5 text-amber-300" /> : <Moon className="h-5 w-5 text-sky-700" />}</button></div></header>;
}
