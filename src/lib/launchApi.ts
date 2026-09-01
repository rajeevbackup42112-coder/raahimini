'use client';

import { createClient } from '@/lib/supabase/client';

export type RaahiTransactionAccess = {
  public_transactions_enabled?: boolean;
  pilot_account?: boolean;
  can_transact?: boolean;
  mode?: 'PUBLIC'|'PILOT'|'BROWSE_ONLY';
  message?: string;
};

export async function getRaahiTransactionAccess(): Promise<RaahiTransactionAccess> {
  const { data, error } = await createClient().rpc('get_raahi_transaction_access');
  if (error) throw error;
  return (data || {}) as RaahiTransactionAccess;
}
