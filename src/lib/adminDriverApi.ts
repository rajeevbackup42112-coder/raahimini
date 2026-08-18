'use client';

import { createClient } from '@/lib/supabase/client';

export interface DriverCandidate {
  profile_id: string;
  display_name: string;
  phone: string | null;
  role: string;
  is_restricted: boolean;
  driver_id: string | null;
  driver_phone: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  registration_number: string | null;
  vehicle_model: string | null;
  capacity: number | null;
}

export async function adminListDriverCandidates(): Promise<DriverCandidate[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_list_driver_candidates');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function adminOnboardDriver(input: {
  profileId: string;
  driverName: string;
  phone: string;
  registrationNumber: string;
  vehicleModel: string;
  vehicleType: string;
  capacity: 4 | 6 | 8;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_onboard_driver', {
    p_profile_id: input.profileId,
    p_driver_name: input.driverName,
    p_phone: input.phone,
    p_registration_number: input.registrationNumber,
    p_vehicle_model: input.vehicleModel,
    p_vehicle_type: input.vehicleType,
    p_capacity: input.capacity,
  });
  if (error) return { success: false, error: error.message };
  return data as { success: boolean; error?: string; driver_id?: string };
}

export async function adminDeactivateDriver(driverId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_deactivate_driver', { p_driver_id: driverId });
  if (error) return { success: false, error: error.message };
  return data as { success: boolean; error?: string };
}
