import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordRejectedGpsObservation } from "@/server/operational-observability";
import { mapTripError } from "@/lib/trip-api";

const schema=z.object({action:z.enum(["BEGIN_APPROACH","ARRIVE","START_BOARDING","BOARDED","NO_SHOW","DEPART_OUTBOUND","COMPLETE_OUTBOUND","START_RETURN_BOARDING","RETURN_BOARDED","RETURN_NO_SHOW","DEPART_RETURN","COMPLETE_RETURN"]),rideId:z.string().uuid().optional(),bookingId:z.string().uuid().optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),accuracyMeters:z.number().positive().optional(),capturedAt:z.string().datetime().optional(),idempotencyKey:z.string().min(8).max(200)});
type RpcResult={data:unknown;error:{message:string;code?:string}|null};
export async function POST(request:Request){
 const correlationId=crypto.randomUUID();const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Trip fulfilment details are invalid.",correlationId},{status:400});
 const supabase=await createClient();const{data:claims}=await supabase.auth.getClaims();if(!claims?.claims?.sub)return NextResponse.json({ok:false,code:"UNAUTHENTICATED",message:"Sign in to continue.",correlationId},{status:401});
 const i=parsed.data;let result:RpcResult;
 if(["BOARDED","NO_SHOW","RETURN_BOARDED","RETURN_NO_SHOW"].includes(i.action)){
  if(!i.bookingId)return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Passenger booking is required.",correlationId},{status:400});
  const rpc=i.action==="BOARDED"?"driver_mark_trip_boarded":i.action==="NO_SHOW"?"driver_report_trip_no_show":i.action==="RETURN_BOARDED"?"driver_mark_trip_return_boarded":"driver_report_trip_return_no_show";
  result=await supabase.rpc(rpc,{p_booking_id:i.bookingId,p_idempotency_key:i.idempotencyKey});
 }else{
  if(!i.rideId)return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Ride is required.",correlationId},{status:400});
  if(["ARRIVE","COMPLETE_OUTBOUND","COMPLETE_RETURN"].includes(i.action)){
   if(i.latitude==null||i.longitude==null||i.accuracyMeters==null||!i.capturedAt)return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Fresh GPS evidence is required.",correlationId},{status:400});
   const rpc=i.action==="ARRIVE"?"driver_arrive_trip":i.action==="COMPLETE_OUTBOUND"?"driver_complete_trip_outbound":"driver_complete_trip_return";
   result=await supabase.rpc(rpc,{p_ride_id:i.rideId,p_latitude:i.latitude,p_longitude:i.longitude,p_accuracy_meters:i.accuracyMeters,p_captured_at:i.capturedAt,p_idempotency_key:i.idempotencyKey});
  }else{
   const rpc=i.action==="BEGIN_APPROACH"?"driver_begin_trip_approach":i.action==="START_BOARDING"?"driver_start_trip_boarding":i.action==="DEPART_OUTBOUND"?"driver_depart_trip":i.action==="START_RETURN_BOARDING"?"driver_start_trip_return_boarding":"driver_depart_trip_return";
   result=await supabase.rpc(rpc,{p_ride_id:i.rideId,p_idempotency_key:i.idempotencyKey});
  }
 }
 if(result.error){const hit=mapTripError(result.error.message);if(hit){if(hit[0]==="TRIP_LOCATION_NOT_VERIFIED"&&i.rideId&&i.accuracyMeters!=null&&i.capturedAt){const observation=await recordRejectedGpsObservation({actorProfileId:String(claims.claims.sub),rideId:i.rideId,action:i.action,rejectionCode:hit[0],accuracyMeters:i.accuracyMeters,capturedAt:i.capturedAt,correlationId});if(!observation.ok)console.error("rejected GPS observation failed",{correlationId,code:observation.code});}return NextResponse.json({ok:false,code:hit[0],message:hit[2],correlationId},{status:hit[1]});}console.error("trip fulfilment failed",{correlationId,code:result.error.code});return NextResponse.json({ok:false,code:"COMMAND_FAILED",message:"Raahi could not update this Trip step.",correlationId},{status:500});}
 return NextResponse.json({ok:true,value:result.data,correlationId});
}
