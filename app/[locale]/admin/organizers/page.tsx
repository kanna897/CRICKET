import { redirect } from "next/navigation";
import { OrganizerManagement, OrganizerSummary } from "@/components/organizer-management";
import { resolveApplicationRole } from "@/lib/application-role";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function OrganizersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: currentData } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const current = currentData as { role: string } | null;
  if (resolveApplicationRole(current?.role) !== "master_admin") redirect(`/${locale}/admin`);

  const { data } = await supabase.from("profiles").select("*").eq("role", "organizer").order("created_at", { ascending: false });
  const organizers = (data || []) as unknown as OrganizerSummary[];
  return <OrganizerManagement organizers={organizers} />;
}
