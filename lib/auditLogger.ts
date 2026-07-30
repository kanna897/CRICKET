import { supabase } from './supabase';

type AuditAction = 
  | 'Admin Login'
  | 'Tournament Created'
  | 'Tournament Updated'
  | 'Tournament Deleted'
  | 'Team Created'
  | 'Team Updated'
  | 'Team Deleted'
  | 'Player Created'
  | 'Player Updated'
  | 'Player Deleted'
  | 'Bulk Player Import'
  | 'Fixture Generated'
  | 'Match Started'
  | 'Match Locked'
  | 'Match Unlocked'
  | 'Match Completed'
  | 'Scorecard Edited'
  | 'Tournament Completed'
  | 'Restore Operations'
  | 'Export Operations';

interface AuditLogPayload {
  userId: string;
  userName?: string;
  userRole?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  deviceBrowser?: string;
}

export const logAuditEvent = async (payload: AuditLogPayload) => {
  try {
     
    const { error } = await supabase.from('audit_logs')
      .insert([
        {
          user_id: payload.userId,
          user_name: payload.userName || 'System Admin',
          user_role: payload.userRole || 'admin',
          action: payload.action,
          entity_type: payload.entityType,
          entity_id: payload.entityId,
          old_values: payload.oldValues || {},
          new_values: payload.newValues || {},
          ip_address: payload.ipAddress || 'unknown',
          device_browser: payload.deviceBrowser || 'unknown'
        }
      ]);
    if (error) {
      console.error('Failed to insert audit log:', error);
    }
  } catch (err) {
    console.error('Audit Logger Exception:', err);
  }
};
