'use client';

import { createClient } from '@/lib/supabase/client';

export type DriverSelfOnboardingInput = {
  driverName: string;
  registrationNumber: string;
  vehicleModel: string;
  vehicleType: string;
  capacity: number;
  originAreaId: string;
};

export type DriverSelfOnboardingResult = {
  success: boolean;
  error?: string;
  driver_id?: string;
  vehicle_id?: string;
  origin_area_id?: string;
  next?: string;
  operations_unlocked?: boolean;
};

export async function selfOnboardAsDriver(input: DriverSelfOnboardingInput): Promise<DriverSelfOnboardingResult> {
  const { data, error } = await createClient().rpc('self_onboard_as_driver', {
    p_driver_name: input.driverName.trim(),
    p_registration_number: input.registrationNumber.trim(),
    p_vehicle_model: input.vehicleModel.trim(),
    p_vehicle_type: input.vehicleType.trim(),
    p_capacity: input.capacity,
    p_origin_area_id: input.originAreaId,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not create your Raahi Driver profile');
  return data as DriverSelfOnboardingResult;
}
