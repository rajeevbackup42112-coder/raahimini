import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root=process.cwd();
const read=(p:string)=>readFileSync(`${root}/${p}`,"utf8");
const schema=read("supabase/migrations/20260906230102_slice11_raahi_trip_schema.sql");
const helpers=read("supabase/migrations/20260906230819_slice11_raahi_trip_helpers.sql");
const driver=read("supabase/migrations/20260906231049_slice11_raahi_trip_driver_commands.sql");
const threshold=read("supabase/migrations/20260907013902_slice11_raahi_trip_threshold_booking.sql");
const cancelExpiry=read("supabase/migrations/20260907013928_slice11_raahi_trip_cancel_expiry.sql");
const lifecycle=read("supabase/migrations/20260907014242_slice11_raahi_trip_pilot_market_lifecycle.sql");
const projections=read("supabase/migrations/20260907014437_slice11_raahi_trip_projections.sql");
const outbound=read("supabase/migrations/20260907014718_slice11_raahi_trip_outbound_fulfilment.sql");
const returns=read("supabase/migrations/20260907014810_slice11_raahi_trip_return_fulfilment.sql");
const privacy=read("supabase/migrations/20260907015048_slice11_raahi_trip_driver_projection_privacy.sql");
const manifest=read("supabase/migrations/20260907020016_slice11_raahi_trip_driver_manifest_projection.sql");
const devFixture=read("supabase/migrations/20260907032149_slice11_dev_test_driver_operating_market_fixture.sql");
const bridgeFix=read("supabase/migrations/20260907033240_slice11_trip_confirmed_booking_bridge_order.sql");
const APIs=["src/app/api/trips/create-draft/route.ts","src/app/api/trips/update/route.ts","src/app/api/trips/publish/route.ts","src/app/api/trips/book/route.ts","src/app/api/trips/cancel-booking/route.ts","src/app/api/driver/trips/cancel/route.ts","src/app/api/driver/trips/fulfilment/route.ts"].map(read).join("\n");
const explore=read("src/app/explore/page.tsx");
const detail=read("src/app/explore/[offeringId]/page.tsx");
const passengerUi=read("src/features/trips/TripOfferingActions.tsx");
const driverUi=read("src/features/trips/DriverTripWorkspace.tsx");
const goPage=read("src/app/go/page.tsx");

describe("Slice 11 — Raahi Trips / Explore",()=>{
 it("models Driver Trip supply separately from Passenger tentative demand",()=>{
  expect(schema).toContain("create table public.trip_offerings");
  expect(schema).toContain("create table public.trip_bookings");
  expect(schema).toContain("trip_offering_id uuid references public.trip_offerings");
  expect(schema).toContain("trip_booking_id uuid references public.trip_bookings");
 });
 it("denies direct client access to canonical Trip tables",()=>{
  expect(schema).toContain("trip_offerings_no_direct_client_access");
  expect(schema).toContain("trip_bookings_no_direct_client_access");
  expect(schema).toContain("using(false) with check(false)");
 });
 it("keeps Trip as mobility rather than a package-tour product",()=>{
  expect(schema).toContain("GOMOH_RAAHI_TRIPS");
  expect(explore).toContain("transport, destination wait and return");
  expect(explore).toContain("not bundled hotels, guides, meals or tickets");
 });
 it("separates deliberate draft creation from publishing",()=>{
  expect(driver).toContain("create_trip_draft");
  expect(driver).toContain("publish_trip_offering");
  expect(driver).toContain("'DRAFT'");
  expect(driverUi).toContain("Preview before draft");
  expect(driverUi).toContain("Publish Trip");
 });
 it("creates no Ride or commitment merely by publishing",()=>{
  const publish=driver.split("private.publish_trip_offering")[1]?.split("public.publish_trip_offering")[0]??"";
  expect(publish).not.toContain("insert into public.mobility_commitments");
  expect(publish).not.toContain("insert into public.rides");
  expect(publish).toContain("status='FILLING'");
 });
 it("permanently locks published terms after the first-ever Passenger booking",()=>{
  expect(driver).toContain("update_unbooked_trip");
  expect(driver).toContain("exists(select 1 from public.trip_bookings b where b.offering_id=v_o.id)");
  expect(driver).toContain("TRIP_ALREADY_BOOKED");
 });
 it("serializes capacity and prevents self-booking",()=>{
  expect(threshold).toContain("where id=p_offering_id for update");
  expect(threshold).toContain("TRIP_DRIVER_CANNOT_BOOK_SELF");
  expect(threshold).toContain("TRIP_ACTIVE_BOOKING_EXISTS");
  expect(threshold).toContain("TRIP_CAPACITY_UNAVAILABLE");
 });
 it("keeps below-threshold Passenger demand explicitly FILLING",()=>{
  expect(threshold).toContain("'FILLING'");
  expect(threshold).toContain("'trip_confirmed',v_o.status='CONFIRMED'");
  expect(passengerUi).toContain("not guaranteed until the threshold is reached");
 });
 it("confirms threshold atomically into one shared RAAHI_TRIP commitment and Ride",()=>{
  expect(threshold).toContain("confirm_trip_threshold_locked");
  expect(threshold).toContain("insert into public.mobility_commitments");
  expect(threshold).toContain("'RAAHI_TRIP'");
  expect(threshold).toContain("insert into public.rides");
  expect(threshold).toContain("insert into public.ride_bookings");
 });
 it("records confirmation as one SYSTEM fact, not as Passenger approval",()=>{
  expect(threshold).toContain("RAAHI_TRIP_CONFIRMED");
  expect(threshold).toContain("'SYSTEM',null");
  expect(threshold).toContain("'threshold',v_o.min_confirmation_seats");
 });
 it("initializes confirmed Trip bookings as two-leg return bookings",()=>{
  expect(helpers).toContain("p.service_type in ('FIXED_ROUND_TRIP','RAAHI_TRIP')");
  expect(helpers).toContain("new.return_status:='PENDING'");
  expect(threshold).toContain("return_not_before");
 });
 it("does not unconfirm a Trip when a confirmed Passenger later cancels",()=>{
  expect(cancelExpiry).toContain("v_b.status='CONFIRMED'");
  expect(cancelExpiry).toContain("'trip_status',v_o.status");
  expect(cancelExpiry).not.toContain("set status='FILLING'");
 });
 it("expires a missed threshold penalty-free with SYSTEM idempotency",()=>{
  expect(cancelExpiry).toContain("expire_trip_offering");
  expect(cancelExpiry).toContain("claim_system_command");
  expect(cancelExpiry).toContain("'NOT_CONFIRMED'");
  expect(cancelExpiry).toContain("'penalty_free',true");
 });
 it("supports PILOT market lifecycle without weakening Product lifecycle",()=>{
  expect(lifecycle).toContain("m.status in ('PILOT','ACTIVE','SCALING')");
  expect(driver).toContain("p.status in ('PILOT','ACTIVE')");
 });
 it("projects trust booleans without raw DL or RC document evidence",()=>{
  expect(projections).toContain("carpool_trust_json");
  expect(projections).toContain("private.carpool_trust_json(t.driver_id,t.vehicle_id)");
  expect(projections).not.toContain("document_url");
  expect(projections).not.toContain("storage_path");
 });
 it("reveals Driver contact only after the Passenger booking is confirmed",()=>{
  expect(projections).toContain("'driver_phone'");
  expect(projections).toContain("mb.status='CONFIRMED'");
  expect(projections).toContain("not in ('COMPLETED','CANCELLED')");
 });
 it("keeps pre-confirmation Passenger identity out of the Driver workspace",()=>{
  expect(privacy).toContain("t.status not in ('DRAFT','FILLING','NOT_CONFIRMED','EXPIRED')");
  expect(driverUi).toContain("Passenger identities stay private until confirmation");
 });
 it("projects authoritative outbound and return manifest state to the Driver",()=>{
  expect(manifest).toContain("'ride_booking_status',rb.status");
  expect(manifest).toContain("'return_status',rb.return_status");
  expect(driverUi).toContain("Return boarded");
 });
 it("uses dynamic Product-location GPS verification for Driver-created destinations",()=>{
  expect(outbound).toContain("verify_trip_rule_zone");
  expect(outbound).toContain("destination_location_id");
  expect(returns).toContain("'return_completion'");
  expect(returns).toContain("verify_trip_rule_zone(v_ride.id,'return_completion'");
 });
 it("keeps the full two-leg lifecycle on the common Ride and Commitment kernel",()=>{
  expect(outbound).toContain("OUTBOUND_IN_PROGRESS");
  expect(outbound).toContain("WAITING_FOR_RETURN");
  expect(returns).toContain("RETURN_BOARDING");
  expect(returns).toContain("RETURN_IN_PROGRESS");
  expect(returns).toContain("update public.mobility_commitments set status='COMPLETED'");
  expect(returns).toContain("update public.trip_offerings set status='COMPLETED'");
 });
 it("lets shared payment creation follow completed Ride bookings",()=>{
  expect(returns).toContain("update public.ride_bookings set status='COMPLETED'");
  expect(returns).toContain("update public.trip_bookings");
 });
 it("keeps every Trip mutation behind canonical RPCs",()=>{
  expect(APIs).toContain("create_trip_draft");
  expect(APIs).toContain("publish_trip_offering");
  expect(APIs).toContain("book_trip_seats");
  expect(APIs).toContain("cancel_trip_booking");
  expect(APIs).toContain("driver_complete_trip_return");
  expect(APIs).not.toContain(".from(");
 });
 it("makes Explore a destination-discovery surface with explicit confirmation risk",()=>{
  expect(explore).toContain("Where could I go?");
  expect(explore).toContain('t.status==="FILLING"');
  expect(detail).toContain("<TripOfferingActions offering={t}/>");
  expect(passengerUi).toContain("needed to confirm");
 });
 it("gives Drivers a deliberate preview plus two-leg fulfilment workspace",()=>{
  expect(driverUi).toContain("Preview before draft");
  expect(driverUi).toContain("Create draft for review");
  expect(driverUi).toContain("Start outbound boarding");
  expect(driverUi).toContain("Start return boarding");
  expect(driverUi).toContain("DriverPaymentCard");
  expect(driverUi).toContain("ReportIssue");
 });
 it("connects Explore to the ordinary ride-finding journey without replacing mobility services",()=>{
  expect(goPage).toContain("Explore day trips · Where could I go?");
  expect(goPage).toContain("Shared one way");
  expect(goPage).toContain("Private car · Driver quotes");
 });
 it("provisions synthetic Drivers with a Current Operating Market",()=>{
  expect(devFixture).toContain("insert into public.driver_operating_markets");
  expect(devFixture).toContain("market_id = excluded.market_id");
  expect(devFixture).toContain("operating_market_id");
 });
 it("creates confirmed Trip and Ride Booking bridges in FK-safe order",()=>{
  const tripInsert=bridgeFix.indexOf("insert into public.trip_bookings");
  const rideInsert=bridgeFix.indexOf("insert into public.ride_bookings");
  const bridgeUpdate=bridgeFix.indexOf("update public.trip_bookings set ride_booking_id=v_rb");
  expect(tripInsert).toBeGreaterThan(-1);
  expect(rideInsert).toBeGreaterThan(tripInsert);
  expect(bridgeUpdate).toBeGreaterThan(rideInsert);
 });
 it("renders Passenger booking, payment and support as separate concerns",()=>{
  expect(passengerUi).toContain('offering.status==="FILLING"?"Reserve":"Book"');
  expect(passengerUi).toContain("This Raahi Trip is confirmed");
  expect(passengerUi).toContain("PassengerPaymentCard");
  expect(passengerUi).toContain("ReportIssue");
 });
});
