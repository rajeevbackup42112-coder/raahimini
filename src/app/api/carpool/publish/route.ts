import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapCarpoolError } from "@/lib/carpool-api";

const schema = z.object({ productId:z.string().uuid(), vehicleId:z.string().uuid(), originLocationId:z.string().uuid(), destinationLocationId:z.string().uuid(), departureAt:z.string().datetime(), offeredSeats:z.number().int().min(1).max(12), contributionPerSeatInr:z.number().int().positive(), idempotencyKey:z.string().min(8).max(200) });
export async function POST(request: Request) {
  const correlationId=crypto.randomUUID(); const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({ok:false,code:"VALIDATION_FAILED",message:"Carpool details are invalid.",correlationId},{status:400});
  const supabase=await createClient(); const {data:claims}=await supabase.auth.getClaims();
  if(!claims?.claims?.sub) return NextResponse.json({ok:false,code:"UNAUTHENTICATED",message:"Sign in to publish a Carpool journey.",correlationId},{status:401});
  const i=parsed.data; const {data,error}=await supabase.rpc("publish_carpool_journey",{p_product_id:i.productId,p_vehicle_id:i.vehicleId,p_origin_location_id:i.originLocationId,p_destination_location_id:i.destinationLocationId,p_departure_at:i.departureAt,p_offered_seats:i.offeredSeats,p_contribution_per_seat_inr:i.contributionPerSeatInr,p_idempotency_key:i.idempotencyKey});
  if(error){const hit=mapCarpoolError(error.message); if(hit)return NextResponse.json({ok:false,code:hit[0],message:hit[2],correlationId},{status:hit[1]}); console.error("publish_carpool_journey failed",{correlationId,code:error.code}); return NextResponse.json({ok:false,code:"COMMAND_FAILED",message:"Raahi could not publish this Carpool journey.",correlationId},{status:500});}
  return NextResponse.json({ok:true,value:data,correlationId});
}
