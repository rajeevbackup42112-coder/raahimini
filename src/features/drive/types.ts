export type DriveMarketOption = {
  market_id: string;
  market_name: string;
  status: "PREPARING" | "PILOT" | "ACTIVE" | "SCALING";
};

export type OperatingMarketSummary = {
  market_id: string;
  market_name: string;
  verified_at: string;
  verification_method: "GPS" | "SYSTEM_ARRIVAL" | "ADMIN_EXCEPTION";
  verification_accuracy_meters: number | null;
};

export type DriveContext = {
  driver_id: string;
  standing: string;
  home_market: { market_id: string; market_name: string };
  operating_market: OperatingMarketSummary | null;
  available_markets: DriveMarketOption[];
};

export type SetOperatingMarketInput = {
  marketId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  idempotencyKey: string;
};

export type SetOperatingMarketResult = {
  driver_id: string;
  market_id: string;
  market_name: string;
  verified_at: string;
  verification_method: "GPS";
  changed: boolean;
};