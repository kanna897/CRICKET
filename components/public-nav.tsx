"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CrickpulseLogo } from "@/components/crickpulse-logo";
import { Eye, EyeOff, Languages, Loader2, Moon, ShieldCheck, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { supabase } from "@/lib/supabase";

const publicLinks = [{ href: "", key: "home" }, { href: "/tournaments", key: "tournaments" }, { href: "/auction", key: "auction" }, { href: "/teams", key: "teams" }, { href: "/fixtures", key: "matches" }, { href: "/rankings", key: "rankings" }, { href: "/points", key: "points" }, { href: "/stats", key: "statistics" }, { href: "/hall-of-fame", key: "awards" }, { href: "/compare", key: "compare" }] as const;
// Contract labels retained in the English dictionary: Player Registration, Admin Login.

export function PublicNav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("PublicNav");
  const { resolvedTheme, setTheme } = useTheme();
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [managedRegistration, setManagedRegistration] = useState<{ id: string; enabled: boolean } | null>(null);
  const [togglingRegistration, setTogglingRegistration] = useState(false);
  const localeMatch = pathname.match(/^\/(en|ta|si)(?=\/|$)/);
  const locale = localeMatch?.[1] || "en";
  const isHomePage = pathname === `/${locale}`;
  useEffect(() => {
    void (async () => {
      const { data: openRows } = await (supabase.from("tournaments") as any).select("id").eq("player_registration_enabled", true).is("deleted_at", null).limit(1);
      setRegistrationOpen(Boolean(openRows?.length));
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const { data: profile } = await (supabase.from("profiles") as any).select("role").eq("id", user.id).maybeSingle();
      let managerQuery = (supabase.from("tournaments") as any).select("id,player_registration_enabled").is("deleted_at", null).order("created_at", { ascending: false }).limit(1);
      if (profile?.role !== "master_admin") managerQuery = managerQuery.eq("organizer_id", user.id);
      const { data: managedRows } = await managerQuery;
      if (managedRows?.length) setManagedRegistration({ id: managedRows[0].id, enabled: managedRows[0].player_registration_enabled });
    })();
  }, []);
  async function toggleRegistration() {
    if (!managedRegistration || togglingRegistration) return;
    setTogglingRegistration(true);
    const enabled = !managedRegistration.enabled;
    const { data, error } = await (supabase.from("tournaments") as any).update({ player_registration_enabled: enabled }).eq("id", managedRegistration.id).select("id").maybeSingle();
    setTogglingRegistration(false);
    if (error || !data) return alert(error?.message || "You cannot change player registration for this tournament.");
    setManagedRegistration({ ...managedRegistration, enabled });
    setRegistrationOpen(enabled);
  }
  const changeLocale = (nextLocale: string) => {
    localStorage.setItem("crickpulse-locale", nextLocale);
    router.replace(pathname.replace(/^\/(en|ta|si)(?=\/|$)/, `/${nextLocale}`));
  };
  return <header className="public-stadium-nav public-landing-nav sticky top-0 z-40 border-b shadow-sm backdrop-blur-xl"><div className="mx-auto flex min-h-16 max-w-[95rem] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:min-h-[4.5rem] sm:flex-nowrap sm:px-7"><Link href={`/${locale}`} aria-label="Crickpulse home" className="public-nav-logo isolate inline-flex rounded-xl px-2 py-1 transition hover:opacity-90"><CrickpulseLogo className="h-9 w-36 object-contain sm:h-11 sm:w-44" /></Link>{!isHomePage && <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto text-xs font-extrabold tracking-wide sm:order-none sm:w-auto sm:justify-start sm:text-sm">{publicLinks.map((item) => { const href = `/${locale}${item.href}`; const active = item.href ? pathname.includes(item.href) : pathname === `/${locale}`; return <Link key={item.key} href={href} className={`whitespace-nowrap rounded-lg px-2.5 py-2 transition hover:text-emerald-400 sm:px-3 ${active ? "text-emerald-400" : ""}`}>{t(item.key)}</Link>; })}</nav>}<div className="public-nav-actions"><label className="relative inline-flex items-center" title={t("language")}><Languages className="pointer-events-none absolute left-2 h-4 w-4"/><select aria-label={t("language")} value={locale} onChange={(event)=>changeLocale(event.target.value)} className="h-10 rounded-lg border border-white/20 bg-transparent pl-8 pr-2 text-xs font-black text-current outline-none"><option className="text-slate-950" value="en">EN</option><option className="text-slate-950" value="ta">தமிழ்</option><option className="text-slate-950" value="si">සිංහල</option></select></label><button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label={t("theme")}>{resolvedTheme === "dark" ? <Sun /> : <Moon />}</button>{registrationOpen && <Link className="player-registration-nav-action" href={`/${locale}/register-player`}><Eye />{t("playerRegistration")}</Link>}{managedRegistration && <button className="registration-visibility-action" title={`${managedRegistration.enabled ? "Hide" : "Unhide"} player registration`} type="button" onClick={toggleRegistration} disabled={togglingRegistration} aria-label={`${managedRegistration.enabled ? "Hide" : "Unhide"} player registration`}>{togglingRegistration ? <Loader2 className="animate-spin"/> : managedRegistration.enabled ? <EyeOff/> : <Eye/>}</button>}<Link className="admin-login-nav-action" href={`/${locale}/login`}><ShieldCheck />{t("adminLogin")}</Link></div></div></header>;
}
