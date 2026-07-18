import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type Role = 'super_admin' | 'tournament_admin' | 'scorer' | 'viewer';

export interface UserRole {
  role: Role;
  tournament_id: string | null;
}

export function useRBAC() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role, tournament_id')
        .eq('user_id', session.user.id);

      if (!error && data) {
        setRoles(data as UserRole[]);
      }
      setLoading(false);
    }
    fetchRoles();
  }, []);

  const hasRole = (role: Role, tournamentId?: string) => {
    // Super admins have universal access
    if (roles.some(r => r.role === 'super_admin')) return true;

    // specific role checks
    return roles.some(r => {
      if (r.role !== role) return false;
      if (tournamentId && r.tournament_id !== tournamentId && r.tournament_id !== null) return false;
      return true;
    });
  };

  return { roles, hasRole, loading };
}
