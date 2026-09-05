# Raahi 2.0 UML Freeze v1.0

**Frozen:** 2026-09-05
**Companion:** `RAAHI_2_0_ARCHITECTURE_FREEZE_V1.md`
**Purpose:** Versioned target-domain diagrams. Current legacy tables/RPCs may differ until migrated.

## 1. System context

```mermaid
flowchart LR
    P[Passenger / Traveller] --> R[Raahi Platform]
    D[Driver / Vehicle Supplier] --> R
    MA[Market Operations] --> R
    SA[State Operations] --> R
    TS[Trust & Safety / Verification] --> R
    B[Local Business] --> R
    R --> AUTH[Authentication / OTP]
    R --> MAP[Maps / GPS]
    R --> NOTIF[Push / SMS / In-app]
    R --> DB[(Authoritative PostgreSQL)]
```

Ownership rule: Humans express intent; Raahi defines rules; System executes; Admin handles exceptions.

## 2. Geographic and Product model
```mermaid
classDiagram
    class Country
    class State
    class Market
    class Location
    class Corridor
    class ServiceProduct
    Country "1" --> "many" State
    State "1" --> "many" Market
    Market "1" --> "many" Location : contains / operates
    Corridor "1" --> "1" Location : origin
    Corridor "1" --> "1" Location : destination
    Market "1" --> "many" ServiceProduct : owns origin products
    ServiceProduct "many" --> "1" Corridor : serves
```

A Market may be publicly branded as a city/town while remaining an operational boundary internally. A Location may be a town, station, airport or other mobility node.

## 3. Identity, Driver and operating-market model

```mermaid
classDiagram
    class User
    class Capability
    class DriverProfile
    class Vehicle
    class Market
    class OperatingMarketSession
    class ProductAvailability
    class MobilityCommitment
    User "1" --> "many" Capability
    User "1" --> "0..1" DriverProfile
    DriverProfile "1" --> "many" Vehicle
    DriverProfile "many" --> "1" Market : home_market
    DriverProfile "1" --> "0..1" OperatingMarketSession
    OperatingMarketSession "many" --> "1" Market : current_operating_market
    OperatingMarketSession "1" --> "many" ProductAvailability
    ProductAvailability "many" --> "1" ServiceProduct
    DriverProfile "1" --> "many" MobilityCommitment
    Vehicle "1" --> "many" MobilityCommitment
```

Eligibility is based on verified Driver + eligible Vehicle + Current Operating Market + explicit Product availability + no conflict. Home Market does not grant FIFO priority.

## 4. Core marketplace domain

```mermaid
classDiagram
    class TravelIntent
    class PassengerFixedRequest
    class DriverAvailability
    class Ride
    class Booking
    class RideEvent
    class PaymentAcknowledgement
    class ReliabilityEvent
    class Case
    class MobilityCommitment
    class ServiceProduct
    PassengerFixedRequest "many" --> "1" ServiceProduct
    DriverAvailability "many" --> "1" ServiceProduct
    PassengerFixedRequest "many" --> "0..1" Ride : matched_into
    DriverAvailability "many" --> "0..1" Ride : matched_into
    Ride "1" --> "many" Booking
    Ride "1" --> "many" RideEvent
    Ride "1" --> "1..many" MobilityCommitment
    Booking "1" --> "0..1" PaymentAcknowledgement
    Ride "1" --> "many" ReliabilityEvent
    Case "many" --> "0..1" Ride
    Case "many" --> "0..1" Booking
    TravelIntent "many" --> "0..1" ServiceProduct : may_resolve_to
```

Travel Intent is not a Booking. Queue requests are not Rides until matching creates a commitment.

## 5. Fixed One Way sequence

```mermaid
sequenceDiagram
    participant P as Passenger
    participant S as Raahi System
    participant D as Driver
    participant DB as PostgreSQL
    P->>S: Join Product passenger queue (seat group)
    S->>DB: Validate + persist FIFO request
    D->>S: Join Product driver queue
    S->>DB: Validate Operating Market/Vehicle + persist FIFO
    S->>DB: Evaluate compatible FIFO clearing condition
    alt clearing condition met
        S->>DB: Atomic lock + create Ride/Bookings/Commitments
        DB-->>S: Committed assignment
        S-->>P: Driver/Vehicle/trust revealed
        S-->>D: Ride assigned â€” proceed
    else not met
        S-->>P: Queue/liquidity state only
        S-->>D: Queue position/aggregate demand only
    end
```

No active car exists merely because the first Driver joined. No pre-match Passenger/Driver identity browsing exists.

## 6. Driver Operating Market state

```mermaid
stateDiagram-v2
    [*] --> HomeContext
    HomeContext --> OperatingMarketSelected : choose market + location proof
    OperatingMarketSelected --> ProductAvailable : opt into product / join queue
    ProductAvailable --> Committed : atomic assignment / accepted binding work
    ProductAvailable --> OperatingMarketSelected : leave availability
    OperatingMarketSelected --> HomeContext : end operating session
    Committed --> OperatingMarketSelected : fulfilment completed at current/destination context
    Committed --> Restricted : serious safety/standing event
```

Changing Operating Market exits incompatible uncommitted availability and never carries FIFO position.
## 7. Fixed Round Trip lifecycle

```mermaid
stateDiagram-v2
    [*] --> MATCHED
    MATCHED --> OUTBOUND_BOARDING
    OUTBOUND_BOARDING --> OUTBOUND_IN_PROGRESS
    OUTBOUND_IN_PROGRESS --> OUTBOUND_COMPLETED
    OUTBOUND_COMPLETED --> WAITING_FOR_RETURN
    WAITING_FOR_RETURN --> RETURN_BOARDING
    RETURN_BOARDING --> RETURN_IN_PROGRESS
    RETURN_IN_PROGRESS --> COMPLETED
    MATCHED --> CANCELLED
    OUTBOUND_BOARDING --> DRIVER_FAILED
    RETURN_BOARDING --> RETURN_FAILURE
    RETURN_IN_PROGRESS --> RETURN_FAILURE
```

The same Driver, Vehicle and booked return capacity remain committed through the full window.

## 8. Outstation quote/accept sequence

```mermaid
sequenceDiagram
    participant P as Passenger
    participant S as Raahi System
    participant D as Eligible Drivers
    participant DB as PostgreSQL
    P->>S: Create Outstation request
    S->>DB: Persist request + resolve eligible audience
    S-->>D: Private lead
    D->>S: Quote / Ignore
    S->>DB: Version quote privately
    S-->>P: Show valid quotes + trust projection
    P->>S: Accept selected quote revision
    S->>DB: Atomic recheck expiry/revision/eligibility/conflicts
    alt valid
        DB-->>S: Accept one + close others + create commitment
        S-->>P: Driver selected / contact unlocked
        S-->>D: Booking confirmed
    else stale/conflict
        S-->>P: Refresh current state; no partial acceptance
    end
```

## 9. Raahi Trip lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> FILLING : publish
    FILLING --> CONFIRMED : threshold reached before deadline
    FILLING --> NOT_CONFIRMED : deadline without threshold
    CONFIRMED --> UPCOMING
    UPCOMING --> BOARDING
    BOARDING --> OUTBOUND_IN_PROGRESS
    OUTBOUND_IN_PROGRESS --> AT_DESTINATION
    AT_DESTINATION --> RETURN_BOARDING
    RETURN_BOARDING --> RETURN_IN_PROGRESS
    RETURN_IN_PROGRESS --> COMPLETED
    CONFIRMED --> DRIVER_CANCELLED
```

Threshold is a one-time confirmation trigger. Once confirmed, later passenger cancellations do not silently unconfirm the Trip.

## 10. Payment and Case states

```mermaid
stateDiagram-v2
    [*] --> DUE
    DUE --> PASSENGER_MARKED_PAID
    PASSENGER_MARKED_PAID --> DRIVER_CONFIRMED_RECEIVED
    PASSENGER_MARKED_PAID --> PAYMENT_DISPUTED
    DUE --> PAYMENT_DISPUTED
```

```mermaid
stateDiagram-v2
    [*] --> OPEN
    OPEN --> ACKNOWLEDGED
    ACKNOWLEDGED --> UNDER_REVIEW
    UNDER_REVIEW --> RESOLVED
    UNDER_REVIEW --> CLOSED_NO_ACTION
    UNDER_REVIEW --> UNABLE_TO_DETERMINE
    UNDER_REVIEW --> ESCALATED
```

Ride state, Payment state and Case state remain separate authoritative objects.
## 11. Admin permission and scope model

```mermaid
classDiagram
    class AdminGrant
    class Permission
    class Scope
    class Market
    class State
    class User
    User "1" --> "many" AdminGrant
    AdminGrant "many" --> "1" Permission
    AdminGrant "many" --> "1" Scope
    Scope "0..1" --> "1" Market
    Scope "0..1" --> "1" State
```

Examples: Market Operations@Gomoh, Market Operations@Dhanbad, Verification@Jharkhand, TrustSafety@Jharkhand, PlatformAdmin@India.

Admin access is purpose-limited and audited. Market Operations cannot gain unrelated Platform authority through UI navigation.

## 12. Market lifecycle and route opportunity

```mermaid
stateDiagram-v2
    [*] --> DISCOVERED
    DISCOVERED --> PREPARING
    PREPARING --> PILOT
    PILOT --> ACTIVE
    ACTIVE --> SCALING
    ACTIVE --> PAUSED
    PILOT --> PAUSED
    PAUSED --> PILOT
```

```mermaid
stateDiagram-v2
    [*] --> DEMAND_SIGNALLED
    DEMAND_SIGNALLED --> UNDER_EVALUATION
    UNDER_EVALUATION --> PILOT_APPROVED
    PILOT_APPROVED --> PILOT
    PILOT --> ACTIVE
    ACTIVE --> PAUSED
    PAUSED --> ACTIVE
    UNDER_EVALUATION --> RETIRED
```

The System may surface opportunity; authorized Operations chooses whether to pilot/activate.

## 13. Cross-service commitment guard

```mermaid
flowchart TD
    A[Binding marketplace action] --> B{Driver + Vehicle eligible?}
    B -- No --> X[Reject]
    B -- Yes --> C{Overlapping incompatible commitment?}
    C -- Yes --> X
    C -- No --> D[Atomic commitment creation]
    D --> E[Create/update Ride or service commitment state]
    E --> F[Notify affected participants from committed server state]
```

Exactly one commitment authority must be consulted by Fixed, Round Trip, Outstation, Carpool and Raahi Trips.

## 14. Metrics tree

```mermaid
flowchart TD
    C[Company] --> S[State]
    S --> M[Market]
    M --> CO[Corridor]
    CO --> P[Service Product]
    P --> OP[Operational metrics]
    P --> BM[Business metrics]
    OP --> DS[Demand Success / Match Time / Fill / Completion]
    OP --> EX[Cancellation / No-show / Safety / Exceptions]
    BM --> RR[Repeat / Retention / Driver Activation]
    BM --> EC[Revenue / Operating Cost / Contribution]
```

Company north-star candidates are Successful Journeys per Active Market per Week, Demand Success Rate, Repeat Journey Rate and Time to Liquidity.

## 15. Diagram governance

These diagrams are frozen target behavior. A material change requires an explicit Decision/ADR and corresponding acceptance-test impact before implementation.

Legacy tables such as current `trips`, `trip_seats`, `seat_requests`, `driver_queue` and exclusive `profiles.role` remain implementation evidence until deliberately superseded; they do not redefine this target UML.
