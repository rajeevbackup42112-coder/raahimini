'use client';

import { createClient } from '@/lib/supabase/client';

export type DriverTrustBadge={
  success:boolean;error?:string;driver_id?:string;display_name?:string;
  driving_licence_verified?:boolean;vehicle_rc_verified?:boolean;driver_photo_verified?:boolean;car_photos_verified?:boolean;fully_verified?:boolean;
  vehicle_number?:string;vehicle_type?:string;vehicle_model?:string;capacity?:number;
};

export async function getDriverTrustBadge(driverId:string):Promise<DriverTrustBadge>{
  const {data,error}=await createClient().rpc('get_driver_trust_badge',{p_driver_id:driverId});
  if(error)return {success:false,error:error.message};
  return (data||{success:false}) as DriverTrustBadge;
}

export async function getDriverProfilePhotoUrl(driverId:string):Promise<string|null>{
  const supabase=createClient();
  const {data,error}=await supabase.rpc('get_driver_verified_profile_photo',{p_driver_id:driverId});
  if(error||!data?.length)return null;
  const path=data[0]?.storage_path as string|undefined;
  if(!path)return null;
  const {data:signed,error:signedError}=await supabase.storage.from('driver-verification').createSignedUrl(path,120);
  if(signedError||!signed?.signedUrl)return null;
  return signed.signedUrl;
}
