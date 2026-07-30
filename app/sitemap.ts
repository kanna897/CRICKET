import type { MetadataRoute } from "next";
import { locales, publicSupabase, siteUrl } from "@/lib/seo";

const staticRoutes = [
  "",
  "/discover",
  "/tournaments",
  "/fixtures",
  "/teams",
  "/points",
  "/rankings",
  "/stats",
  "/hall-of-fame",
  "/compare",
] as const;

type EntityPath = { path: string; priority: number; changeFrequency: "hourly" | "daily" | "weekly" };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl().origin;
  const entities: EntityPath[] = [];
  const db = publicSupabase();

  if (db) {
    const [tournaments, matches, teams, players] = await Promise.all([
      db.from("tournaments").select("id").is("deleted_at", null),
      db.from("matches").select("id,status"),
      db.from("teams").select("id").is("deleted_at", null),
      db.from("players").select("id"),
    ]);
    for (const row of tournaments.data ?? []) {
      entities.push({ path: `/tournaments/${row.id}`, priority: 0.8, changeFrequency: "daily" });
    }
    for (const row of matches.data ?? []) {
      entities.push({
        path: `/match/${row.id}`,
        priority: row.status === "live" ? 1 : 0.8,
        changeFrequency: row.status === "live" ? "hourly" : "daily",
      });
    }
    for (const row of teams.data ?? []) {
      entities.push({ path: `/teams/${row.id}`, priority: 0.7, changeFrequency: "weekly" });
    }
    for (const row of players.data ?? []) {
      entities.push({ path: `/players/${row.id}`, priority: 0.6, changeFrequency: "weekly" });
    }
  }

  const staticEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    staticRoutes.map((path) => ({
      url: `${origin}/${locale}${path}`,
      changeFrequency: path === "/fixtures" ? "hourly" as const : "daily" as const,
      priority: path === "" ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(locales.map((language) => [language, `${origin}/${language}${path}`])),
      },
    })),
  );

  const entityEntries: MetadataRoute.Sitemap = entities.flatMap((entity) =>
    locales.map((locale) => ({
      url: `${origin}/${locale}${entity.path}`,
      changeFrequency: entity.changeFrequency,
      priority: entity.priority,
      alternates: {
        languages: Object.fromEntries(
          locales.map((language) => [language, `${origin}/${language}${entity.path}`]),
        ),
      },
    })),
  );

  return [...staticEntries, ...entityEntries];
}
