import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { resolveApplicationRole } from "@/lib/application-role";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) redirect(`/${locale}/login?error=session`);
  const userId = claims.sub;
  const userEmail = typeof claims.email === "string" ? claims.email : null;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  const profile = profileData as { name?: string; display_name?: string; role: string } | null;
  let role = resolveApplicationRole(profile?.role);

  // Existing installations store the master administrator in user_roles.
  // Keep that account usable while newer installations use profiles.role.
  if (!role) {
    const { data: legacyAdminRoleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();
    const legacyAdminRole = legacyAdminRoleData as { role: string } | null;
    role = resolveApplicationRole(legacyAdminRole?.role);
  }

  if (!role) {
    redirect(`/${locale}/login?error=unauthorized`);
  }

  const appMetadata = claims.app_metadata as { must_change_password?: boolean } | undefined;
  if (role === "organizer" && appMetadata?.must_change_password === true) {
    redirect(`/${locale}/change-password`);
  }

  return <AdminShell userId={userId} displayName={profile?.name || profile?.display_name || userEmail || "Administrator"} role={role}>{children}</AdminShell>;
}
