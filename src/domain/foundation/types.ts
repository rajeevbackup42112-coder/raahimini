export type Capability = "PASSENGER" | "DRIVER" | "ADMIN";

export type MarketStatus =
  | "DISCOVERED"
  | "PREPARING"
  | "PILOT"
  | "ACTIVE"
  | "SCALING"
  | "PAUSED";

export type ServiceType =
  | "FIXED_ONE_WAY"
  | "FIXED_ROUND_TRIP"
  | "OUTSTATION"
  | "CARPOOL"
  | "RAAHI_TRIP";

export interface MarketRef {
  id: string;
  code: string;
  name: string;
  status: MarketStatus;
}

export interface LocationRef {
  id: string;
  marketId: string | null;
  name: string;
}

export interface CorridorRef {
  id: string;
  originLocationId: string;
  destinationLocationId: string;
}

export interface ServiceProductRef {
  id: string;
  marketId: string;
  corridorId: string;
  serviceType: ServiceType;
  enabled: boolean;
}

export interface DriverMarketContext {
  driverId: string;
  homeMarketId: string;
  operatingMarketId: string | null;
  operatingMarketVerifiedAt: Date | null;
}

export interface DriverEligibilityInput {
  driver: DriverMarketContext;
  product: ServiceProductRef;
  hasDriverCapability: boolean;
  driverStandingActive: boolean;
  vehicleEligible: boolean;
  optedIn: boolean;
  hasConflictingCommitment: boolean;
}
