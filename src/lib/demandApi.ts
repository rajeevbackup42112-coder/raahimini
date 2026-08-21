'use client';

import { createClient } from '@/lib/supabase/client';

export type DemandLabel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type DemandIntentKind = 'NOW' | 'SCHEDULED';

export interface RouteDemandSummary {
  route_id: string;
  now_count: number;
  scheduled_count: number;
  demand_label: DemandLabel;
}

export interface DemandIntentResult {
  success: boolean;
  intent_id?: string;
  deduplicated?: boolean;
  already_inactive?: boolean;
  error?: string;
}

const rpc = async (name: string, args: Record<string, unknown> = {}) => {
  const supabase = createClient();
  return supabase.rpc(name, args);
};

export async function getRouteDemandSummary(routeId: string): Promise<RouteDemandSummary> {
  const { data, error } = await rpc('get_route_demand_summary', { p_route_id: routeId });
  if (error) {
    console.error(error.message);
    return { route_id: routeId, now_count: 0, scheduled_count: 0, demand_label: 'NONE' };
  }
  return (data as RouteDemandSummary) ?? { route_id: routeId, now_count: 0, scheduled_count: 0, demand_label: 'NONE' };
}

export async function createNowDemandIntent(routeId: string, waitToleranceMinutes = 30): Promise<DemandIntentResult> {
  const { data, error } = await rpc('create_demand_intent', {
    p_route_id: routeId,
    p_intent_kind: 'NOW',
    p_earliest_at: new Date().toISOString(),
    p_latest_at: null,
    p_wait_tolerance_minutes: waitToleranceMinutes,
  });
  return error ? { success: false, error: error.message } : data as DemandIntentResult;
}

export async function createScheduledDemandIntent(
  routeId: string,
  earliestAt: Date,
  latestAt: Date
): Promise<DemandIntentResult> {
  if (latestAt.getTime() <= earliestAt.getTime()) {
    return { success: false, error: 'Travel window must end after it starts.' };
  }
  const { data, error } = await rpc('create_demand_intent', {
    p_route_id: routeId,
    p_intent_kind: 'SCHEDULED',
    p_earliest_at: earliestAt.toISOString(),
    p_latest_at: latestAt.toISOString(),
    p_wait_tolerance_minutes: null,
  });
  return error ? { success: false, error: error.message } : data as DemandIntentResult;
}

export async function cancelDemandIntent(intentId: string): Promise<DemandIntentResult> {
  const { data, error } = await rpc('cancel_my_demand_intent', { p_intent_id: intentId });
  return error ? { success: false, error: error.message } : data as DemandIntentResult;
}
