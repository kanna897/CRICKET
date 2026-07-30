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
    ? await db.from("teams").select("name,logo_url").eq("id", id).is("deleted_at", null).maybeSingle()
    : { data: null };
  if (!data) return { title: "Team", robots: { index: false, follow: false } };
  return entityMetadata({
    locale,
    path: `/teams/${id}`,
    title: data.name,
    description: `${data.name}. ${seoCopy(locale).team}`,
    image: data.logo_url,
  });
}

export default function TeamMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
