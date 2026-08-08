import { redirect } from "next/navigation";
import { MandatoryPasswordChange } from "@/components/mandatory-password-change";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function ChangePasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.app_metadata?.must_change_password !== true) redirect(`/${locale}/admin/settings`);

  return <MandatoryPasswordChange locale={locale} email={user.email || "your account"} />;
}
