'use client';

import { createClient } from '@/lib/supabase/client';

export type OutstationOrigin={location_id:string;location_name:string;state:string};
export type OutstationRequest={
  request_id:string;origin_location_id:string;origin_name:string;destination_text:string;travel_type:'ONE_WAY'|'ROUND_TRIP';
  departure_at:string;return_at:string|null;passenger_count:number;notes:string|null;status:string;quote_count:number;
  accepted_quote_id:string|null;accepted_price:number|null;accepted_driver_name:string|null;accepted_driver_phone:string|null;
  accepted_vehicle_number:string|null;accepted_vehicle_model:string|null;created_at:string;
};
export type OutstationQuote={
  quote_id:string;driver_id:string;driver_name:string;total_price:number;includes_tolls:boolean;includes_parking:boolean;driver_note:string|null;
  vehicle_number:string;vehicle_type:string|null;vehicle_model:string|null;vehicle_capacity:number;quote_status:string;expires_at:string;
  driving_licence_verified:boolean;vehicle_rc_verified:boolean;car_photos_verified:boolean;fully_verified:boolean;driver_phone:string|null;
};
export type DriverOutstationLead={
  request_id:string;origin_location_id:string;origin_name:string;destination_text:string;travel_type:string;departure_at:string;return_at:string|null;
  passenger_count:number;notes:string|null;created_at:string;my_quote_id:string|null;my_quote_price:number|null;my_quote_status:string|null;
  verification_complete:boolean;vehicle_capacity:number;
};
export type DriverOutstationBooking={
  request_id:string;quote_id:string;origin_name:string;destination_text:string;travel_type:string;departure_at:string;return_at:string|null;
  passenger_count:number;passenger_name:string;passenger_phone:string;total_price:number;includes_tolls:boolean;includes_parking:boolean;vehicle_number:string;
};
export type AdminOutstationRow={
  request_id:string;passenger_name:string;passenger_phone:string;origin_name:string;destination_text:string;travel_type:string;departure_at:string;return_at:string|null;
  passenger_count:number;effective_status:string;quote_count:number;accepted_driver_name:string|null;accepted_driver_phone:string|null;accepted_price:number|null;
  accepted_vehicle_number:string|null;created_at:string;
};

function fail(error:any,fallback:string):never{throw new Error(error?.message||fallback)}

export async function getOutstationOrigins(){const {data,error}=await createClient().rpc('get_outstation_origins');if(error)fail(error,'Could not load outstation origins');return (data||[]) as OutstationOrigin[];}
export async function createOutstationRequest(input:{originLocationId:string;destination:string;travelType:'ONE_WAY'|'ROUND_TRIP';departureAt:string;returnAt?:string|null;passengerCount:number;notes?:string}){
  const {data,error}=await createClient().rpc('create_outstation_request',{p_origin_location_id:input.originLocationId,p_destination_text:input.destination,p_travel_type:input.travelType,p_departure_at:input.departureAt,p_return_at:input.returnAt||null,p_passenger_count:input.passengerCount,p_notes:input.notes||null});
  if(error||!data?.success) fail(error||{message:data?.error},'Could not create outstation request'); return data;
}
export async function getMyOutstationRequests(){const {data,error}=await createClient().rpc('get_my_outstation_requests');if(error)fail(error,'Could not load outstation requests');return (data||[]) as OutstationRequest[];}
export async function getMyOutstationQuotes(requestId:string){const {data,error}=await createClient().rpc('get_my_outstation_quotes',{p_request_id:requestId});if(error)fail(error,'Could not load quotes');return (data||[]) as OutstationQuote[];}
export async function cancelOutstationRequest(requestId:string){const {data,error}=await createClient().rpc('cancel_my_outstation_request',{p_request_id:requestId});if(error||!data?.success)fail(error||{message:data?.error},'Could not cancel request');return data;}
export async function acceptOutstationQuote(quoteId:string){const {data,error}=await createClient().rpc('accept_outstation_quote',{p_quote_id:quoteId});if(error||!data?.success)fail(error||{message:data?.error},'Could not accept quote');return data;}
export async function getDriverOutstationLeads(){const {data,error}=await createClient().rpc('driver_get_outstation_leads');if(error)fail(error,'Could not load outstation leads');return (data||[]) as DriverOutstationLead[];}
export async function sendDriverOutstationQuote(input:{requestId:string;totalPrice:number;includesTolls:boolean;includesParking:boolean;note?:string}){const {data,error}=await createClient().rpc('driver_send_outstation_quote',{p_request_id:input.requestId,p_total_price:input.totalPrice,p_includes_tolls:input.includesTolls,p_includes_parking:input.includesParking,p_driver_note:input.note||null});if(error||!data?.success)fail(error||{message:data?.error},'Could not send quote');return data;}
export async function ignoreDriverOutstationRequest(requestId:string){const {data,error}=await createClient().rpc('driver_ignore_outstation_request',{p_request_id:requestId});if(error||!data?.success)fail(error||{message:data?.error},'Could not ignore lead');return data;}
export async function withdrawDriverOutstationQuote(quoteId:string){const {data,error}=await createClient().rpc('driver_withdraw_outstation_quote',{p_quote_id:quoteId});if(error||!data?.success)fail(error||{message:data?.error},'Could not withdraw quote');return data;}
export async function getDriverOutstationBookings(){const {data,error}=await createClient().rpc('driver_get_my_outstation_bookings');if(error)fail(error,'Could not load accepted outstation bookings');return (data||[]) as DriverOutstationBooking[];}
export async function getAdminOutstationMarketplace(){const {data,error}=await createClient().rpc('admin_get_outstation_marketplace');if(error)fail(error,'Could not load Outstation marketplace');return (data||[]) as AdminOutstationRow[];}
export async function getDriverCarPhotoUrls(driverId:string){
  const supabase=createClient(); const {data,error}=await supabase.rpc('get_driver_verified_car_photos',{p_driver_id:driverId}); if(error)return [];
  const paths=(data||[]).map((row:any)=>row.storage_path as string); if(!paths.length)return [];
  const urls:string[]=[]; for(const path of paths){const {data:signed}=await supabase.storage.from('driver-verification').createSignedUrl(path,120);if(signed?.signedUrl)urls.push(signed.signedUrl);} return urls;
}
