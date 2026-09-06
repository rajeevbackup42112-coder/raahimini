import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = process.cwd();
const schema = readFileSync(`${root}/supabase/migrations/20260906032209_slice10_carpool_schema.sql`, "utf8");
const commands = readFileSync(`${root}/supabase/migrations/20260906032443_slice10_carpool_commands.sql`, "utf8");
const change = readFileSync(`${root}/supabase/migrations/20260906032612_slice10_carpool_change_fulfilment.sql`, "utf8");
const projections = readFileSync(`${root}/supabase/migrations/20260906042455_slice10_carpool_projections.sql`, "utf8");
const bookingFareFix = readFileSync(`${root}/supabase/migrations/20260906052926_slice10_carpool_booking_generated_fare_fix.sql`, "utf8");
const cancelCodeFix = readFileSync(`${root}/supabase/migrations/20260906165328_slice10_carpool_in_fulfilment_cancel_code.sql`, "utf8");
const projectionPermissions = readFileSync(`${root}/supabase/migrations/20260906170747_slice10_carpool_projection_wrapper_permissions.sql`, "utf8");
const bookApi = readFileSync(`${root}/src/app/api/carpool/book/route.ts`, "utf8");
const fulfilmentApi = readFileSync(`${root}/src/app/api/driver/carpool/fulfilment/route.ts`, "utf8");
const passengerUi = readFileSync(`${root}/src/features/carpool/CarpoolJourneyActions.tsx`, "utf8");
const driverUi = readFileSync(`${root}/src/features/carpool/DriverCarpoolWorkspace.tsx`, "utf8");
const goPage = readFileSync(`${root}/src/app/go/page.tsx`, "utf8");
const publishOnly = commands
  .split("create or replace function private.publish_carpool_journey")[1]
  .split("create or replace function public.publish_carpool_journey")[0];

describe("Slice 10 — Carpool", () => {
  it("models Driver journey supply separately from Passenger bookings", () => {
    expect(schema).toContain("create table public.carpool_journeys");
    expect(schema).toContain("create table public.carpool_bookings");
    expect(schema).toContain("create table public.carpool_change_proposals");
    expect(schema).toContain("create table public.carpool_booking_change_consents");
  });

  it("keeps direct client table access denied", () => {
    expect(schema).toContain("carpool_journeys_no_direct_client_access");
    expect(schema).toContain("carpool_bookings_no_direct_client_access");
    expect(schema).toContain("using(false) with check(false)");
  });

  it("publishes spare seats as Driver-owned activity before Passenger demand", () => {
    expect(commands).toContain("publish_carpool_journey");
    expect(commands).toContain("private.current_driver_id()");
    expect(commands).toContain("insert into public.carpool_journeys");
    expect(publishOnly).not.toContain("insert into public.mobility_commitments");
  });

  it("locks price and material edits after the first booking commitment", () => {
    expect(commands).toContain("update_uncommitted_carpool");
    expect(commands).toContain("CARPOOL_ALREADY_COMMITTED");
    expect(commands).toContain("v_j.active_booked_seats<>0");
    expect(commands).toContain("v_j.commitment_id is not null");
  });

  it("serializes capacity by locking the Journey before booking", () => {
    expect(commands).toContain("where id=p_journey_id for update");
    expect(commands).toContain("CARPOOL_CAPACITY_UNAVAILABLE");
    expect(commands).toContain("v_j.active_booked_seats+p_seat_count>v_j.offered_seats");
  });

  it("prevents the Driver from booking their own Carpool", () => {
    expect(commands).toContain("CARPOOL_DRIVER_CANNOT_BOOK_SELF");
    expect(commands).toContain("v_driver.profile_id=v_profile");
  });

  it("creates the shared commitment and Ride atomically on the first Passenger booking", () => {
    expect(commands).toContain("if v_j.commitment_id is null then");
    expect(commands).toContain("insert into public.mobility_commitments");
    expect(commands).toContain("'CARPOOL'");
    expect(commands).toContain("insert into public.rides");
    expect(commands).toContain("insert into public.ride_bookings");
    expect(commands).toContain("'PER_SEAT'");
  });

  it("leaves generated booking fare ownership with the shared Ride kernel", () => {
    expect(bookingFareFix).toContain("seat_count,fare_per_seat_inr,boarding_context,commercial_model,quoted_total_inr");
    expect(bookingFareFix).not.toContain("fare_per_seat_inr,total_fare_inr,boarding_context");
  });

  it("returns the frozen in-fulfilment cancellation code", () => {
    expect(cancelCodeFix).toContain("v_j.status='IN_FULFILMENT'");
    expect(cancelCodeFix).toContain("CARPOOL_ALREADY_IN_FULFILMENT");
  });

  it("uses the shared cross-service commitment exclusion boundary", () => {
    expect(commands).toContain("CARPOOL_COMMITMENT_CONFLICT");
    expect(commands).toContain("exclusion_violation");
    expect(change).toContain("CARPOOL_COMMITMENT_CONFLICT");
  });

  it("requires Passenger re-consent for material time or destination changes", () => {
    expect(change).toContain("propose_material_carpool_change");
    expect(change).toContain("carpool_booking_change_consents");
    expect(change).toContain("accept_or_reject_material_change");
    expect(change).toContain("CHANGE_PENDING");
  });

  it("makes rejection a penalty-free Passenger exit instead of silent mutation", () => {
    expect(change).toContain("CARPOOL_CHANGE_REJECTED_EXIT");
    expect(change).toContain("'penalty_free',true");
    expect(change).toContain("status='CANCELLED'");
  });

  it("keeps Carpool fulfilment on authenticated canonical RPCs", () => {
    expect(fulfilmentApi).toContain("driver_begin_carpool_approach");
    expect(fulfilmentApi).toContain("driver_arrive_carpool_ride");
    expect(fulfilmentApi).toContain("driver_start_carpool_boarding");
    expect(fulfilmentApi).toContain("driver_mark_carpool_boarded");
    expect(fulfilmentApi).toContain("driver_depart_carpool_ride");
    expect(fulfilmentApi).toContain("driver_complete_carpool_ride");
    expect(fulfilmentApi).not.toContain(".from(");
  });

  it("completes Carpool on the common Ride, Booking and Commitment lifecycle", () => {
    expect(change).toContain("status='COMPLETED'");
    expect(change).toContain("update public.ride_bookings set status='COMPLETED'");
    expect(change).toContain("update public.mobility_commitments set status='COMPLETED'");
    expect(change).toContain("update public.carpool_journeys set status='COMPLETED'");
  });


  it("allows security-invoker Carpool wrappers to call private projections", () => {
    expect(projectionPermissions).toContain("grant execute on function private.get_carpool_catalog() to authenticated");
    expect(projectionPermissions).toContain("grant execute on function private.get_carpool_journey(uuid) to authenticated");
    expect(projectionPermissions).toContain("grant execute on function private.get_driver_carpool_workspace() to authenticated");
  });

  it("projects verification booleans without raw document paths", () => {
    expect(projections).toContain("carpool_trust_json");
    expect(projections).toContain("'driver_verified'");
    expect(projections).toContain("'vehicle_rc_verified'");
    expect(projections).toContain("'vehicle_photos_verified'");
    expect(projections).not.toContain("document_url");
    expect(projections).not.toContain("storage_path");
  });

  it("scopes phone contact to an active Passenger commitment", () => {
    expect(projections).toContain("'driver_phone'");
    expect(projections).toContain("mb.status='ACTIVE'");
    expect(projections).toContain("not in ('COMPLETED','CANCELLED')");
    expect(projections).toContain("'passenger_phone'");
  });

  it("projects direct payment per Carpool booking", () => {
    expect(projections).toContain("payment_acknowledgements");
    expect(projections).toContain("pay.ride_booking_id=mb.ride_booking_id");
    expect(projections).toContain("pay.ride_booking_id=b.ride_booking_id");
    expect(projections).toContain("'amount_inr'");
  });

  it("keeps booking route behind the canonical RPC", () => {
    expect(bookApi).toContain("book_carpool_seats");
    expect(bookApi).toContain("p_journey_id");
    expect(bookApi).toContain("p_seat_count");
    expect(bookApi).not.toContain(".from(");
  });

  it("shows Carpool beside other mobility options without replacing them", () => {
    expect(goPage).toContain("Carpool · Driver is already going");
    expect(goPage).toContain("Book instantly");
    expect(goPage).toContain("Shared one way");
    expect(goPage).toContain("Private car · Driver quotes");
  });

  it("shows Passenger booking, change consent, payment and support as separate concerns", () => {
    expect(passengerUi).toContain("Instant seat booking");
    expect(passengerUi).toContain("Accept change");
    expect(passengerUi).toContain("exit without penalty");
    expect(passengerUi).toContain("PassengerPaymentCard");
    expect(passengerUi).toContain("ReportIssue");
  });

  it("gives the Driver one Carpool management and fulfilment workspace", () => {
    expect(driverUi).toContain("I’m already going");
    expect(driverUi).toContain("Ask Passengers to re-consent");
    expect(driverUi).toContain("Start driving to pickup");
    expect(driverUi).toContain("Complete at destination");
    expect(driverUi).toContain("DriverPaymentCard");
    expect(driverUi).toContain("ReportIssue");
  });
});