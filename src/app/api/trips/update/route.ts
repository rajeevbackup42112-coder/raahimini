import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapTripError } from "@/lib/trip-api";

const schema=z.object({offeringId:z.string().uuid(),vehicleId:z.string().uuid(),originLocationId:z.string().uuid(),destinationLocationId:z.string().uuid(),departureAt:z.string().datetime(),returnDepartureAt:z.string().datetime(),offeredSeats:z.number().int().min(1).max(12),pricePerSeatInr:z.number().int().positive(),minConfirmationSeats:z.number().int().min(1).max(12),confirmationDeadline:z.string().datetime(),itineraryContext:z.string().max(1000).nullable().optional(),idempotencyKey:z.string().min(8).max(200)});
export async function POST(request:Request){
 const correlationId=crypto.randomUUID();const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Trip update is invalid.",correlationId},{status:400});
 const supabase=await createClient();const{data:claims}=await supabase.auth.getClaims();if(!claims?.claims?.sub)return NextResponse.json({ok:false,code:"UNAUTHENTICATED",message:"Sign in to edit this Trip.",correlationId},{status:401});
 const i=parsed.data;const{data,error}=await supabase.rpc("update_unbooked_trip",{p_offering_id:i.offeringId,p_vehicle_id:i.vehicleId,p_origin_location_id:i.originLocationId,p_destination_location_id:i.destinationLocationId,p_departure_at:i.departureAt,p_return_departure_at:i.returnDepartureAt,p_offered_seats:i.offeredSeats,p_price_per_seat_inr:i.pricePerSeatInr,p_min_confirmation_seats:i.minConfirmationSeats,p_confirmation_deadline:i.confirmationDeadline,p_itinerary_context:i.itineraryContext??null,p_idempotency_key:i.idempotencyKey});
 if(error){const hit=mapTripError(error.message);if(hit)return NextResponse.json({ok:false,code:hit[0],message:hit[2],correlationId},{status:hit[1]});console.error("update_unbooked_trip failed",{correlationId,code:error.code});return NextResponse.json({ok:false,code:"COMMAND_FAILED",message:"Raahi could not update this Trip.",correlationId},{status:500});}
 return NextResponse.json({ok:true,value:data,correlationId});
}
