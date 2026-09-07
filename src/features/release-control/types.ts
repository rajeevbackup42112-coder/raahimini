export type ReleaseProduct = {
  product_id: string;
  product_code: string;
  display_name: string;
  service_type: string;
  lifecycle_status: string;
  feature_enabled: boolean;
  effective_available: boolean;
  flag_key: string;
  updated_at: string | null;
  updated_by: string | null;
  config: Record<string, unknown>;
};

export type ReleaseMarket = {
  market_id: string;
  market_code: string;
  market_name: string;
  market_status: string;
  products: ReleaseProduct[];
};

export type ReleaseControlWorkspace = {
  can_manage: boolean;
  markets: ReleaseMarket[];
};