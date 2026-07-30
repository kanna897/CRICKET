import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export const locales = ["en", "ta", "si"] as const;
export type SeoLocale = typeof locales[number];

const copy = {
  en: {
    site: "CrickPulse",
    description: "Live cricket scores, tournaments, teams, player statistics and match updates.",
    tournament: "Tournament fixtures, teams, results and live cricket updates.",
    match: "Live score, scorecard, commentary and match updates.",
    team: "Team squad, player profiles, fixtures and cricket results.",
    player: "Player profile, cricket statistics, recent form and career performance.",
  },
  ta: {
    site: "கிரிக்பல்ஸ்",
    description: "நேரடி கிரிக்கெட் ஸ்கோர், தொடர்கள், அணிகள், வீரர் புள்ளிவிவரங்கள் மற்றும் போட்டி தகவல்கள்.",
    tournament: "தொடர் அட்டவணை, அணிகள், முடிவுகள் மற்றும் நேரடி கிரிக்கெட் தகவல்கள்.",
    match: "நேரடி ஸ்கோர், ஸ்கோர்கார்டு, வர்ணனை மற்றும் போட்டி தகவல்கள்.",
    team: "அணி வீரர்கள், வீரர் விவரங்கள், போட்டிகள் மற்றும் முடிவுகள்.",
    player: "வீரர் விவரம், கிரிக்கெட் புள்ளிவிவரங்கள், சமீபத்திய ஆட்டம் மற்றும் சாதனைகள்.",
  },
  si: {
    site: "ක්‍රික්පල්ස්",
    description: "සජීවී ක්‍රිකට් ලකුණු, තරඟාවලි, කණ්ඩායම්, ක්‍රීඩක සංඛ්‍යාලේඛන සහ තරඟ යාවත්කාලීන.",
    tournament: "තරඟාවලි කාලසටහන්, කණ්ඩායම්, ප්‍රතිඵල සහ සජීවී ක්‍රිකට් යාවත්කාලීන.",
    match: "සජීවී ලකුණු, ලකුණු පුවරුව, විස්තර සහ තරඟ යාවත්කාලීන.",
    team: "කණ්ඩායම් සංචිතය, ක්‍රීඩක පැතිකඩ, තරඟ සහ ප්‍රතිඵල.",
    player: "ක්‍රීඩක පැතිකඩ, ක්‍රිකට් සංඛ්‍යාලේඛන, මෑත දක්ෂතා සහ වෘත්තීය වාර්තා.",
  },
} as const;

export function asLocale(value: string): SeoLocale {
  return locales.includes(value as SeoLocale) ? value as SeoLocale : "en";
}

export function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.PRODUCTION_URL
    ?? process.env.VERCEL_PROJECT_PRODUCTION_URL
    ?? "https://cricket-zeta-jade.vercel.app";
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol.replace(/\/+$/, ""));
}

export function localizedPath(locale: SeoLocale, path = "") {
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`.replace(/\/$/, "");
}

export function languageAlternates(path = "") {
  return Object.fromEntries(locales.map((locale) => [locale, localizedPath(locale, path)]));
}

export function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function entityMetadata(input: {
  locale: SeoLocale;
  path: string;
  title: string;
  description: string;
  image?: string | null;
}): Metadata {
  const image = input.image || "/icons/icon-512.png";
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: localizedPath(input.locale, input.path),
      languages: languageAlternates(input.path),
    },
    openGraph: {
      type: "website",
      locale: input.locale === "ta" ? "ta_IN" : input.locale === "si" ? "si_LK" : "en_US",
      siteName: "CrickPulse",
      title: input.title,
      description: input.description,
      url: localizedPath(input.locale, input.path),
      images: [{ url: image, alt: input.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}

export function seoCopy(locale: SeoLocale) {
  return copy[locale];
}

const pageTitles = {
  en: {
    discover: "Discover Cricket",
    tournaments: "Tournaments",
    fixtures: "Fixtures & Live Scores",
    teams: "Teams",
    points: "Points Table",
    rankings: "Rankings",
    stats: "Cricket Statistics",
    "hall-of-fame": "Hall of Fame",
    compare: "Compare Players",
  },
  ta: {
    discover: "கிரிக்கெட்டை கண்டறியுங்கள்",
    tournaments: "தொடர்கள்",
    fixtures: "போட்டிகள் மற்றும் நேரடி ஸ்கோர்",
    teams: "அணிகள்",
    points: "புள்ளிப் பட்டியல்",
    rankings: "தரவரிசைகள்",
    stats: "கிரிக்கெட் புள்ளிவிவரங்கள்",
    "hall-of-fame": "சாதனையாளர் அரங்கம்",
    compare: "வீரர்களை ஒப்பிடுங்கள்",
  },
  si: {
    discover: "ක්‍රිකට් සොයන්න",
    tournaments: "තරඟාවලි",
    fixtures: "තරඟ සහ සජීවී ලකුණු",
    teams: "කණ්ඩායම්",
    points: "ප්‍රසාද ලකුණු සටහන",
    rankings: "ශ්‍රේණිගත කිරීම්",
    stats: "ක්‍රිකට් සංඛ්‍යාලේඛන",
    "hall-of-fame": "කීර්ති නාමාවලිය",
    compare: "ක්‍රීඩකයන් සසඳන්න",
  },
} as const;

export type StaticSeoPage = keyof typeof pageTitles.en;

export function staticPageMetadata(locale: SeoLocale, page: StaticSeoPage): Metadata {
  return entityMetadata({
    locale,
    path: `/${page}`,
    title: pageTitles[locale][page],
    description: copy[locale].description,
  });
}
