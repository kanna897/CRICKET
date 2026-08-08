import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { OrganizerManagement, OrganizerSummary } from "@/components/organizer-management";
import { resolveApplicationRole } from "@/lib/application-role";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";

export default async function OrganizersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: current } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (resolveApplicationRole(current?.role) !== "master_admin") redirect(`/${locale}/admin`);

  const { data } = await supabase.from("profiles").select("id,display_name,email").eq("role", "organizer").order("created_at", { ascending: false });
  const phoneByUserId = new Map<string, string>();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    authUsers?.users.forEach((authUser) => {
      const phone = authUser.user_metadata?.phone_number;
      if (typeof phone === "string") phoneByUserId.set(authUser.id, phone);
    });
  }
  const organizers: OrganizerSummary[] = (data || []).map((profile) => ({
    id: profile.id,
    name: profile.display_name || "",
    email: profile.email,
    phone_number: phoneByUserId.get(profile.id) || null,
  }));
  return <OrganizerManagement organizers={organizers} />;
}
