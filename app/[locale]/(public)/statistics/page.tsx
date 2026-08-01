import { redirect } from "next/navigation";

export default async function StatisticsAliasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/stats`);
}
