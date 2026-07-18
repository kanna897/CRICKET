import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type Role = 'super_admin' | 'tournament_admin' | 'scorer' | 'viewer';

export async function getServerRoles() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { data } = await supabase
    .from('user_roles')
    .select('role, tournament_id')
    .eq('user_id', session.user.id);

  return data || [];
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
