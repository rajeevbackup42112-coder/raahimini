import { createClient } from "@/lib/supabase/server";
import type { OperationalHealthWorkspace } from "@/features/operational-health/types";

export async function getOperationalHealthWorkspace(){
 const supabase=await createClient();
 const{data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub)return{status:"UNAUTHENTICATED" as const,workspace:null};
 const{data,error}=await supabase.rpc("get_operational_health_workspace");
 if(error){
  if(error.message.includes("ADMIN_CAPABILITY_REQUIRED"))return{status:"NOT_ADMIN" as const,workspace:null};
  console.error("get_operational_health_workspace failed",{code:error.code});
  return{status:"ERROR" as const,workspace:null};
 }
 return{status:"READY" as const,workspace:data as OperationalHealthWorkspace};
}