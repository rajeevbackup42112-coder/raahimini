import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");
const schema = read("supabase/migrations/20260910120000_raahi_shared_demand_bridge_schema.sql");
const rematch = read("supabase/migrations/20260910120060_raahi_shared_expired_hold_rematch.sql");
const commands = read("supabase/migrations/20260910120100_raahi_shared_demand_bridge_commands.sql");
const concurrency = read("supabase/migrations/20260910120150_raahi_shared_concurrency_hardening.sql");
const liveness = read("supabase/migrations/20260910120160_raahi_shared_expired_offer_liveness.sql");
const projections = read("supabase/migrations/20260910120200_raahi_shared_demand_bridge_projections.sql");
const heldProjections = read("supabase/migrations/20260910120250_raahi_shared_held_capacity_projections.sql");
const liveProjections = read("supabase/migrations/20260910120260_raahi_shared_live_hold_projections.sql");
const design = read("docs/RAAHI_SHARED_DEMAND_BRIDGE_DESIGN_V1.md");
const routes = [
  "src/app/api/shared/start/route.ts",
  "src/app/api/shared/match/route.ts",
  "src/app/api/shared/refresh/route.ts",
].map(read).join("\n");
const errors = read("src/lib/shared-api.ts");
const travelErrors = read("src/lib/travel-intent-api.ts");

describe("Raahi Shared — Passenger-originated demand bridge", () => {
  it("keeps explicit Shared requests distinct from ordinary Travel Interests", () => {
    expect(schema).toContain("intent_kind in ('INTEREST','SHARED_REQUEST')");
    expect(schema).toContain("default 'INTEREST'");
    expect(schema).toContain("intent_kind\n)\nwhere status='ACTIVE'");
    expect(commands).toContain("'SHARED_REQUEST'");
    expect(commands).toContain("'creates_booking',false");
  });

  it("does not create a booking merely by starting a shared ride", () => {
    const start = concurrency.slice(concurrency.indexOf("private.start_shared_ride"), concurrency.indexOf("private.decline_shared_trip_match"));
    expect(start).toContain("insert into public.travel_intents");
    expect(start).not.toContain("insert into public.trip_bookings");
    expect(start).not.toContain("insert into public.rides");
    expect(start).not.toContain("insert into public.mobility_commitments");
  });

  it("protects Driver-ready capacity without counting it as confirmed demand", () => {
    expect(schema).toContain("held_seats integer not null default 0");
    expect(schema).toContain("active_booked_seats + held_seats <= offered_seats");
    expect(schema).toContain("set held_seats=held_seats+v_i.seat_count");
    expect(commands).toContain("v_o.active_booked_seats+v_o.held_seats+p_seat_count>v_o.offered_seats");
    expect(heldProjections).toContain("t.offered_seats-t.active_booked_seats-t.held_seats");
  });

  it("makes Shared match rows browser-inaccessible canonical state", () => {
    expect(schema).toContain("create table public.shared_trip_matches");
    expect(schema).toContain("shared_trip_matches_no_direct_client_access");
    expect(schema).toContain("using(false) with check(false)");
    expect(schema).toContain("revoke all on table public.shared_trip_matches from anon,authenticated");
  });

  it("matches exact route and requested time-window demand FIFO", () => {
    expect(liveness).toContain("t.origin_location_id=v_o.origin_location_id");
    expect(liveness).toContain("t.destination_location_id=v_o.destination_location_id");
    expect(liveness).toContain("v_o.departure_at between t.desired_departure_at and t.desired_window_end_at");
    expect(liveness).toContain("order by t.created_at,t.id");
    expect(liveness).toContain("for update of t skip locked");
  });

  it("serializes live Driver offers by locking the Passenger request instead of a time-blind unique index", () => {
    expect(schema).toContain("uq_shared_trip_matches_live_intent");
    expect(liveness).toContain("drop index if exists public.uq_shared_trip_matches_live_intent");
    expect(liveness).toContain("sm.status='OFFERED'");
    expect(liveness).toContain("sm.expires_at>now()");
    expect(liveness).toContain("for update of t skip locked");
    expect(schema).toContain("unique(travel_intent_id,offering_id)");
  });

  it("does not strand a request behind an expired offer from another Driver trip", () => {
    expect(liveness).toContain("drop index if exists public.uq_shared_trip_matches_live_intent");
    expect(liveness).toContain("sm.status='OFFERED'");
    expect(liveness).toContain("sm.expires_at>now()");
    const requestMatcher = liveness.slice(liveness.indexOf("private.match_shared_request"));
    expect(requestMatcher).not.toContain("release_expired_shared_trip_holds(v_expired_offering)");
  });

  it("expires and releases protected seats through a canonical locked helper", () => {
    expect(schema).toContain("release_expired_shared_trip_holds");
    expect(schema).toContain("where id=p_offering_id for update");
    expect(schema).toContain("set held_seats=held_seats-v_match.seat_count");
    expect(schema).toContain("status='EXPIRED'");
    expect(rematch).toContain("sm.expires_at<=now()");
  });

  it("shows availability from unexpired holds even when persisted cleanup is lazy", () => {
    expect(liveProjections).toContain("private.live_shared_held_seats");
    expect(liveProjections).toContain("m.expires_at>now()");
    expect(liveProjections).toContain("'seats_left',greatest(v_offered-v_booked-v_live_held,0)");
    expect(liveProjections).toContain("'protected_seats'");
    expect(liveProjections).toContain("decorate_driver_trip_workspace_live_capacity");
  });

  it("does not keep the unsafe Intent-close trigger as final cancellation authority", () => {
    expect(concurrency).toContain("drop trigger if exists release_shared_holds_on_intent_close");
    expect(liveness).not.toContain("where t.id=p_intent_id for update");
    expect(concurrency).toContain("Read-only ownership check");
  });

  it("cancels a live Shared hold in Offering -> Match -> Intent order", () => {
    const cancel = concurrency.slice(concurrency.indexOf("private.cancel_travel_intent"));
    const offeringLock = cancel.indexOf("where id=v_offering_id for update");
    const matchLock = cancel.indexOf("where travel_intent_id=v_i.id and offering_id=v_offering_id and status='OFFERED'");
    const intentLock = cancel.indexOf("where id=p_intent_id and passenger_profile_id=v_profile for update", matchLock);
    expect(offeringLock).toBeGreaterThan(-1);
    expect(matchLock).toBeGreaterThan(offeringLock);
    expect(intentLock).toBeGreaterThan(matchLock);
    expect(cancel).toContain("raise exception 'SHARED_CANCEL_RETRY' using errcode='40001'");
    expect(cancel).toContain("Subtransaction rollback releases the Intent row lock before retrying");
  });

  it("releases request holds canonically while retaining trip-close hold cleanup", () => {
    const cancel = concurrency.slice(concurrency.indexOf("private.cancel_travel_intent"));
    expect(cancel).toContain("set held_seats=held_seats-v_m.seat_count");
    expect(cancel).toContain("set status='CANCELLED',cancelled_at=now()");
    expect(schema).toContain("release_shared_holds_on_trip_close");
    expect(schema).toContain("'NOT_CONFIRMED','DRIVER_CANCELLED','EXPIRED','IN_FULFILMENT','COMPLETED'");
  });

  it("declines one Driver offer without locking a second offering in the same transaction", () => {
    const decline = concurrency.slice(
      concurrency.indexOf("private.decline_shared_trip_match"),
      concurrency.indexOf("private.cancel_travel_intent"),
    );
    expect(decline).toContain("'refresh_required',true");
    expect(decline).not.toContain("private.match_shared_request");
    expect(decline).toContain("Passenger refresh performs rematching in a new transaction");
  });

  it("rate limits new Shared requests while concurrent duplicates stay deduplicated", () => {
    const start = concurrency.slice(
      concurrency.indexOf("private.start_shared_ride"),
      concurrency.indexOf("private.decline_shared_trip_match"),
    );
    expect(start).toContain("max_intents_per_user_24h");
    expect(start).toContain("TRAVEL_INTENT_RATE_LIMITED");
    expect(start).toContain("on conflict do nothing");
    expect(start).toContain("get diagnostics v_inserted = row_count");
  });

  it("acceptance consumes the hold into the existing Trip booking kernel", () => {
    expect(commands).toContain("accept_shared_trip_match");
    expect(commands).toContain("insert into public.trip_bookings");
    expect(commands).toContain("held_seats=held_seats-v_m.seat_count");
    expect(commands).toContain("active_booked_seats=active_booked_seats+v_m.seat_count");
    expect(commands).toContain("confirm_trip_threshold_locked");
    expect(commands).toContain("resolved_product_id=v_o.product_id");
  });

  it("keeps confirmed-Trip bridge creation in FK-safe order", () => {
    const confirmed = commands.slice(commands.indexOf("else\n    if v_o.ride_id"), commands.indexOf("return private.complete_user_command", commands.indexOf("else\n    if v_o.ride_id")));
    const tripInsert = confirmed.indexOf("insert into public.trip_bookings");
    const rideInsert = confirmed.indexOf("insert into public.ride_bookings");
    const bridgeUpdate = confirmed.indexOf("update public.trip_bookings set ride_booking_id=v_rb");
    expect(tripInsert).toBeGreaterThan(-1);
    expect(rideInsert).toBeGreaterThan(tripInsert);
    expect(bridgeUpdate).toBeGreaterThan(rideInsert);
  });

  it("does not expose Passenger identity in Driver pre-booking demand", () => {
    const driver = projections.slice(projections.indexOf("private.get_driver_shared_demand"), projections.indexOf("private.get_my_shared_requests"));
    expect(driver).toContain("'request_count'");
    expect(driver).toContain("'seat_demand'");
    expect(driver).toContain("'oldest_request_at'");
    expect(driver).not.toContain("'passenger_profile_id'");
    expect(driver).not.toContain("'passenger_name'");
    expect(driver).not.toContain("'phone'");
  });

  it("shows Passenger Driver-ready facts without raw verification documents", () => {
    const passenger = projections.slice(projections.indexOf("private.get_my_shared_requests"), projections.indexOf("private.filter_enabled_trip_discovery"));
    expect(passenger).toContain("'driver_name'");
    expect(passenger).toContain("'vehicle_model'");
    expect(passenger).toContain("'trust'");
    expect(passenger).not.toContain("document_url");
    expect(passenger).not.toContain("storage_path");
    expect(passenger).not.toContain("driver_phone");
  });

  it("adds aggregate Shared demand to the Driver workspace without pre-confirmation identities", () => {
    expect(heldProjections).toContain("'shared_demand',private.get_driver_shared_demand()");
    const fillingPrivacy = heldProjections.indexOf("t.status not in ('DRAFT','FILLING','NOT_CONFIRMED','EXPIRED')");
    expect(fillingPrivacy).toBeGreaterThan(-1);
  });

  it("blocks Product-OFF Shared discovery and new Passenger commitments", () => {
    expect(liveness).toContain("private.product_feature_enabled(v_o.product_id)");
    expect(concurrency).toContain("private.product_feature_enabled(p.id)");
    expect(commands).toContain("private.product_feature_enabled(v_o.product_id)");
    expect(projections).toContain("filter_enabled_trip_discovery");
    expect(design).toContain("OFF means no new discovery");
  });

  it("keeps Shared mutations idempotent and behind RPC APIs", () => {
    expect(concurrency).toContain("claim_user_command('start_shared_ride'");
    expect(commands).toContain("claim_user_command('accept_shared_trip_match'");
    expect(concurrency).toContain("claim_user_command('decline_shared_trip_match'");
    expect(concurrency).toContain("claim_user_command('refresh_shared_ride'");
    expect(routes).toContain('supabase.rpc("start_shared_ride"');
    expect(routes).toContain('"accept_shared_trip_match"');
    expect(routes).toContain('"decline_shared_trip_match"');
    expect(routes).toContain('supabase.rpc("refresh_shared_ride"');
    expect(routes).not.toContain(".from(");
  });

  it("keeps customer-facing API errors in Raahi Shared language", () => {
    expect(errors).toContain("Raahi Shared is not available");
    expect(errors).toContain("Driver offer");
    expect(errors).toContain("several travel requests recently");
    expect(travelErrors).toContain("SHARED_REQUEST_BUSY_RETRY");
    expect(errors).not.toContain("threshold");
    expect(errors).not.toContain("CARPOOL");
  });
});
