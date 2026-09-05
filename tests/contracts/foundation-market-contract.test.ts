import { describe, expect, it } from "vitest";
import { driverCanServeProduct, mayChangeOperatingMarket, passengerCanSearchMarket } from "../../src/domain/foundation/rules";
import type { DriverEligibilityInput, MarketRef, ServiceProductRef } from "../../src/domain/foundation/types";

const dhanbad: MarketRef = { id: "m-dhn", code: "DHANBAD", name: "Dhanbad", status: "ACTIVE" };
const dhanbadToRanchi: ServiceProductRef = {
  id: "p-dhn-rnc",
  marketId: dhanbad.id,
  corridorId: "c-dhn-rnc",
  serviceType: "FIXED_ONE_WAY",
  enabled: true,
};

function eligibility(overrides: Partial<DriverEligibilityInput> = {}): DriverEligibilityInput {
  return {
    driver: {
      driverId: "driver-naresh",
      homeMarketId: "m-gomoh",
      operatingMarketId: "m-dhn",
      operatingMarketVerifiedAt: new Date("2026-09-05T08:00:00Z"),
    },
    product: dhanbadToRanchi,
    hasDriverCapability: true,
    driverStandingActive: true,
    vehicleEligible: true,
    optedIn: true,
    hasConflictingCommitment: false,
    ...overrides,
  };
}

describe("Raahi Next Foundation market contract", () => {
  it("lets a Passenger search an active Market without GPS membership", () => {
    expect(passengerCanSearchMarket(dhanbad)).toBe(true);
  });

  it("lets a Gomoh-home Driver serve Dhanbad-origin work when Dhanbad is the verified Operating Market", () => {
    expect(driverCanServeProduct(eligibility())).toBe(true);
  });

  it("does not let Home Market substitute for verified Operating Market", () => {
    expect(
      driverCanServeProduct(
        eligibility({
          driver: {
            driverId: "driver-naresh",
            homeMarketId: "m-gomoh",
            operatingMarketId: "m-gomoh",
            operatingMarketVerifiedAt: new Date("2026-09-05T08:00:00Z"),
          },
        }),
      ),
    ).toBe(false);
  });

  it("blocks product eligibility when another commitment conflicts", () => {
    expect(driverCanServeProduct(eligibility({ hasConflictingCommitment: true }))).toBe(false);
  });

  it("blocks Operating Market changes during an active commitment", () => {
    expect(mayChangeOperatingMarket(true)).toBe(false);
    expect(mayChangeOperatingMarket(false)).toBe(true);
  });
});
