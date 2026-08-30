import { createClient } from '@/lib/supabase/client';

export type LocalPromotion={promotion_id:string;business_name:string;headline:string;description:string;locality:string|null;contact_phone:string|null;whatsapp_phone:string|null;image_path:string|null;starts_at:string;ends_at:string};
export type AdminLocalPromotion=LocalPromotion&{amount_collected:number;status:'DRAFT'|'ACTIVE'|'ARCHIVED';created_at:string};
export type PromotionDraft={promotionId?:string|null;businessName:string;headline:string;description:string;locality?:string;contactPhone?:string;whatsappPhone?:string;imagePath?:string|null;startsAt:string;endsAt:string;amountCollected:number};

function imageUrl(path:string|null){if(!path)return null;return createClient().storage.from('promotion-assets').getPublicUrl(path).data.publicUrl;}
export function localPromotionImageUrl(path:string|null){return imageUrl(path);}

export async function getActiveLocalPromotions(limit=10){const {data,error}=await createClient().rpc('get_active_local_promotions',{p_limit:limit});if(error)throw error;return (data||[]) as LocalPromotion[];}
export async function adminListLocalPromotions(){const {data,error}=await createClient().rpc('admin_list_local_promotions');if(error)throw error;return (data||[]) as AdminLocalPromotion[];}
export async function adminSaveLocalPromotion(input:PromotionDraft){const {data,error}=await createClient().rpc('admin_save_local_promotion',{p_promotion_id:input.promotionId||null,p_business_name:input.businessName,p_headline:input.headline,p_description:input.description,p_locality:input.locality||null,p_contact_phone:input.contactPhone||null,p_whatsapp_phone:input.whatsappPhone||null,p_image_path:input.imagePath||null,p_starts_at:input.startsAt,p_ends_at:input.endsAt,p_amount_collected:input.amountCollected});if(error)throw error;if(!data?.success)throw new Error(data?.error||'Could not save promotion');return data;}
export async function adminSetLocalPromotionStatus(promotionId:string,status:'DRAFT'|'ACTIVE'|'ARCHIVED'){const {data,error}=await createClient().rpc('admin_set_local_promotion_status',{p_promotion_id:promotionId,p_status:status});if(error)throw error;if(!data?.success)throw new Error(data?.error||'Could not update promotion');return data;}
