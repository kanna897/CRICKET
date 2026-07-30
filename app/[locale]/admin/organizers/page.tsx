import { redirect } from "next/navigation";
import { OrganizerManagement, OrganizerSummary } from "@/components/organizer-management";
import { resolveApplicationRole } from "@/lib/application-role";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function OrganizersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: current } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (resolveApplicationRole(current?.role) !== "master_admin") redirect(`/${locale}/admin`);

  const { data } = await supabase.from("profiles").select("id,display_name,email").eq("role", "organizer").order("created_at", { ascending: false });
  const organizers: OrganizerSummary[] = (data || []).map((profile) => ({
    id: profile.id,
    name: profile.display_name || "",
    email: profile.email,
    phone_number: null,
  }));
  return <OrganizerManagement organizers={organizers} />;
}
