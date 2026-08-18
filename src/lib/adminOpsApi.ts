'use client';

import { createClient } from '@/lib/supabase/client';

export interface AdminActionResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

async function call(name: string, args: Record<string, unknown>): Promise<AdminActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { success: false, error: error.message };
  return (data as AdminActionResult) || { success: false, error: 'No response from server' };
}

export function adminDeactivateDriver(driverId: string) {
  return call('admin_deactivate_driver', { p_driver_id: driverId });
}

export function adminRemoveFromQueue(queueId: string) {
  return call('admin_remove_from_queue', { p_queue_id: queueId });
}

export function adminReorderQueue(queueId: string, newPosition: number) {
  return call('admin_reorder_queue', { p_queue_id: queueId, p_new_position: newPosition });
}
