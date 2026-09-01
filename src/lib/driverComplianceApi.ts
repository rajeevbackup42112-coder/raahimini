'use client';

import { createClient } from '@/lib/supabase/client';

export type ComplianceDocType='VEHICLE_PERMIT'|'VEHICLE_FITNESS'|'VEHICLE_INSURANCE'|'VEHICLE_PUC';
export type ComplianceStatus='MISSING'|'PENDING'|'VERIFIED'|'REJECTED';
export type VehicleClassification='UNDECLARED'|'COMMERCIAL_PERMITTED'|'PRIVATE_NON_TRANSPORT'|'OTHER';
export type ComplianceDoc={document_id:string;document_type:ComplianceDocType;storage_path:string;original_name:string;mime_type:string;file_size:number;created_at:string};
export type DriverLaunchCompliance={success:boolean;error?:string;driver_id?:string;vehicle_classification:VehicleClassification;vehicle_classification_status:ComplianceStatus;vehicle_classification_notes?:string|null;vehicle_permit_status:ComplianceStatus;vehicle_permit_notes?:string|null;vehicle_fitness_status:ComplianceStatus;vehicle_fitness_notes?:string|null;vehicle_insurance_status:ComplianceStatus;vehicle_insurance_notes?:string|null;vehicle_puc_status:ComplianceStatus;vehicle_puc_notes?:string|null;launch_compliant:boolean;documents:ComplianceDoc[]};

export async function getMyDriverLaunchCompliance(){const {data,error}=await createClient().rpc('get_my_driver_launch_compliance');if(error)throw error;return data as DriverLaunchCompliance;}
export async function setMyVehicleClassification(value:Exclude<VehicleClassification,'UNDECLARED'>){const {data,error}=await createClient().rpc('set_my_vehicle_classification',{p_classification:value});if(error||!data?.success)throw new Error(error?.message||data?.error||'Could not save vehicle classification');return data;}
export async function registerDriverComplianceUpload(input:{type:ComplianceDocType;path:string;name:string;mime:string;size:number}){const {data,error}=await createClient().rpc('register_driver_compliance_upload',{p_document_type:input.type,p_storage_path:input.path,p_original_name:input.name,p_mime_type:input.mime,p_file_size:input.size});if(error||!data?.success)throw new Error(error?.message||data?.error||'Could not register compliance document');return data;}
export async function retireMyDriverComplianceDocument(id:string){const {data,error}=await createClient().rpc('retire_my_driver_compliance_document',{p_document_id:id});if(error||!data?.success)throw new Error(error?.message||data?.error||'Could not remove compliance document');return data;}
