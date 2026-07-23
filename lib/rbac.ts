import { createSupabaseServerClient } from "@/lib/supabase-server";

export type Role = 'super_admin' | 'tournament_admin' | 'scorer' | 'viewer';
type ServerRole = { role: Role; tournament_id: string | null };

export async function getServerRoles() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return [];

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role, tournament_id')
    .eq('user_id', userId);

  return (roles || []) as ServerRole[];
}

export async function hasServerRole(role: Role, tournamentId?: string) {
  const roles = await getServerRoles();
  
  if (roles.some(r => r.role === 'super_admin')) return true;

  return roles.some(r => {
    if (r.role !== role) return false;
    if (tournamentId && r.tournament_id !== tournamentId && r.tournament_id !== null) return false;
    return true;
  });
}
