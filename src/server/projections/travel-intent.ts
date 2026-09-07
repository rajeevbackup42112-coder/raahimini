import { createClient } from "@/lib/supabase/server";
import type { MarketIntelligenceMarket, MarketOpportunitySignal, TravelIntentView } from "@/features/travel-intent/types";

export async function getMyTravelIntents() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, intents: [] as TravelIntentView[] };
  const { data, error } = await supabase.rpc("get_my_travel_intents");
  if (error) {
    console.error("get_my_travel_intents failed", { code: error.code });
    return { status: "ERROR" as const, intents: [] as TravelIntentView[] };
  }
  return { status: "READY" as const, intents: (data ?? []) as TravelIntentView[] };
}

export async function getMarketIntelligenceContext() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, markets: [] as MarketIntelligenceMarket[] };
  const { data, error } = await supabase.rpc("get_market_intelligence_context");
  if (error) {
    if (error.message.includes("ADMIN_CAPABILITY_REQUIRED")) return { status: "NOT_ADMIN" as const, markets: [] as MarketIntelligenceMarket[] };
    console.error("get_market_intelligence_context failed", { code: error.code });
    return { status: "ERROR" as const, markets: [] as MarketIntelligenceMarket[] };
  }
  return { status: "READY" as const, markets: ((data as { markets?: MarketIntelligenceMarket[] } | null)?.markets ?? []) };
}

export async function getMarketOpportunitySignals(marketId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, signals: [] as MarketOpportunitySignal[] };
  const { data, error } = await supabase.rpc("get_market_opportunity_signals", { p_market_id: marketId });
  if (error) {
    if (error.message.includes("ADMIN_SCOPE_REQUIRED")) return { status: "FORBIDDEN" as const, signals: [] as MarketOpportunitySignal[] };
    console.error("get_market_opportunity_signals failed", { code: error.code });
    return { status: "ERROR" as const, signals: [] as MarketOpportunitySignal[] };
  }
  return { status: "READY" as const, signals: (data ?? []) as MarketOpportunitySignal[] };
}
