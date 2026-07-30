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
    ? await db.from("tournaments").select("name,logo_url,venue,status").eq("id", id).is("deleted_at", null).maybeSingle()
    : { data: null };
  if (!data) return { title: "Tournament", robots: { index: false, follow: false } };
  const details = [data.venue, data.status].filter(Boolean).join(" · ");
  return entityMetadata({
    locale,
    path: `/tournaments/${id}`,
    title: data.name,
    description: `${data.name}. ${details ? `${details}. ` : ""}${seoCopy(locale).tournament}`,
    image: data.logo_url,
  });
}

export default function TournamentMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
