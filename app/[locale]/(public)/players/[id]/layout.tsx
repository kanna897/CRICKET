import type { Metadata } from "next";
import { asLocale, entityMetadata, publicSupabase, seoCopy } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale = asLocale(rawLocale);
  const db = publicSupabase();
  const { data } = db
    ? await db.from("players").select("name,photo_url,playing_role").eq("id", id).maybeSingle()
    : { data: null };
  if (!data) return { title: "Player", robots: { index: false, follow: false } };
  const role = data.playing_role ? `${data.playing_role}. ` : "";
  return entityMetadata({
    locale,
    path: `/players/${id}`,
    title: data.name,
    description: `${data.name}. ${role}${seoCopy(locale).player}`,
    image: data.photo_url,
  });
}

export default function PlayerMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
