import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapCarpoolError } from "@/lib/carpool-api";

const schema=z.object({action:z.enum(["BEGIN_APPROACH","ARRIVE","START_BOARDING","BOARDED","NO_SHOW","DEPART","COMPLETE"]),rideId:z.string().uuid().optional(),bookingId:z.string().uuid().optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),accuracyMeters:z.number().positive().optional(),capturedAt:z.string().datetime().optional(),idempotencyKey:z.string().min(8).max(200)});
type RpcResult={data:unknown;error:{message:string;code?:string}|null};
export async function POST(request:Request){
 const correlationId=crypto.randomUUID();const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Fulfilment details are invalid.",correlationId},{status:400});
 const supabase=await createClient();const{data:claims}=await supabase.auth.getClaims();if(!claims?.claims?.sub)return NextResponse.json({ok:false,code:"UNAUTHENTICATED",message:"Sign in to continue.",correlationId},{status:401});
 const i=parsed.data;let result:RpcResult;
 if(i.action==="BOARDED"||i.action==="NO_SHOW"){
  if(!i.bookingId)return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Passenger booking is required.",correlationId},{status:400});
  result=await supabase.rpc(i.action==="BOARDED"?"driver_mark_carpool_boarded":"driver_report_carpool_no_show",{p_booking_id:i.bookingId,p_idempotency_key:i.idempotencyKey});
 }else{
  if(!i.rideId)return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Ride is required.",correlationId},{status:400});
  if(i.action==="ARRIVE"||i.action==="COMPLETE"){
   if(i.latitude==null||i.longitude==null||i.accuracyMeters==null||!i.capturedAt)return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Fresh GPS evidence is required.",correlationId},{status:400});
   result=await supabase.rpc(i.action==="ARRIVE"?"driver_arrive_carpool_ride":"driver_complete_carpool_ride",{p_ride_id:i.rideId,p_latitude:i.latitude,p_longitude:i.longitude,p_accuracy_meters:i.accuracyMeters,p_captured_at:i.capturedAt,p_idempotency_key:i.idempotencyKey});
  }else{
   const rpc=i.action==="BEGIN_APPROACH"?"driver_begin_carpool_approach":i.action==="START_BOARDING"?"driver_start_carpool_boarding":"driver_depart_carpool_ride";
   result=await supabase.rpc(rpc,{p_ride_id:i.rideId,p_idempotency_key:i.idempotencyKey});
  }
 }
 if(result.error){const hit=mapCarpoolError(result.error.message);if(hit)return NextResponse.json({ok:false,code:hit[0],message:hit[2],correlationId},{status:hit[1]});console.error("carpool fulfilment failed",{correlationId,code:result.error.code});return NextResponse.json({ok:false,code:"COMMAND_FAILED",message:"Raahi could not update this Carpool trip step.",correlationId},{status:500});}
 return NextResponse.json({ok:true,value:result.data,correlationId});
}
