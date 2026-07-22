import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { resolveApplicationRole } from "@/lib/application-role";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login?error=session`);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as { name?: string; display_name?: string; role: string } | null;
  let role = resolveApplicationRole(profile?.role);

  // Existing installations store the master administrator in user_roles.
  // Keep that account usable while newer installations use profiles.role.
  if (!role) {
    const { data: legacyAdminRoleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    const legacyAdminRole = legacyAdminRoleData as { role: string } | null;
    role = resolveApplicationRole(legacyAdminRole?.role);
  }

  if (!role) {
    redirect(`/${locale}/login?error=unauthorized`);
  }

  return <AdminShell userId={user.id} displayName={profile?.name || profile?.display_name || user.email || "Administrator"} role={role}>{children}</AdminShell>;
}
