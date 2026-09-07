import { createClient } from "@supabase/supabase-js";

type RejectedGpsObservation = {
  actorProfileId: string;
  rideId: string;
  action: string;
  rejectionCode: string;
  accuracyMeters: number;
  capturedAt: string;
  correlationId: string;
};

export async function recordRejectedGpsObservation(input: RejectedGpsObservation) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return { ok: false, code: "OBSERVATION_SERVER_NOT_CONFIGURED" };

  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.rpc("record_rejected_gps_observation_server", {
    p_actor_profile_id: input.actorProfileId,
    p_ride_id: input.rideId,
    p_action: input.action,
    p_rejection_code: input.rejectionCode,
    p_accuracy_meters: input.accuracyMeters,
    p_captured_at: input.capturedAt,
    p_correlation_id: input.correlationId,
  });
  return error ? { ok: false, code: error.code ?? "OBSERVATION_FAILED" } : { ok: true as const };
}