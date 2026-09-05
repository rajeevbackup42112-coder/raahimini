import type { DriverEligibilityInput, MarketRef } from "./types";

export function passengerCanSearchMarket(market: MarketRef): boolean {
  return market.status === "PILOT" || market.status === "ACTIVE" || market.status === "SCALING";
}

export function driverCanServeProduct(input: DriverEligibilityInput): boolean {
  const {
    driver,
    product,
    hasDriverCapability,
    driverStandingActive,
    vehicleEligible,
    optedIn,
    hasConflictingCommitment,
  } = input;

  if (!product.enabled) return false;
  if (!hasDriverCapability || !driverStandingActive || !vehicleEligible || !optedIn) return false;
  if (hasConflictingCommitment) return false;
  if (!driver.operatingMarketId || !driver.operatingMarketVerifiedAt) return false;

  return driver.operatingMarketId === product.marketId;
}

export function mayChangeOperatingMarket(hasActiveCommitment: boolean): boolean {
  return !hasActiveCommitment;
}
