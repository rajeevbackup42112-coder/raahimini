import { createClient } from '@/lib/supabase/client';

export type LegalAcceptanceState = {
  authenticated?: boolean;
  terms_version?: string;
  privacy_version?: string;
  driver_terms_version?: string;
  terms_current?: boolean;
  privacy_current?: boolean;
  driver_terms_current?: boolean;
};

export async function getMyLegalAcceptanceState(): Promise<LegalAcceptanceState> {
  const { data, error } = await createClient().rpc('get_my_legal_acceptance_state');
  if (error) throw error;
  return (data || {}) as LegalAcceptanceState;
}

export async function acceptMyLegalDocuments(mode: 'passenger' | 'driver') {
  const { data, error } = await createClient().rpc('accept_my_legal_documents', {
    p_accept_passenger: mode === 'passenger',
    p_accept_driver: mode === 'driver',
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not save your agreement');
  return data;
}

export function isCurrentForMode(state: LegalAcceptanceState, mode: 'passenger' | 'driver') {
  const base = Boolean(state.terms_current && state.privacy_current);
  return mode === 'passenger' ? base : Boolean(base && state.driver_terms_current);
}
