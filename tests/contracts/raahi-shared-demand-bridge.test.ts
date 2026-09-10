import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");
const schema = read("supabase/migrations/20260910120000_raahi_shared_demand_bridge_schema.sql");
const commands = read("supabase/migrations/20260910120100_raahi_shared_demand_bridge_commands.sql");
const projections = read("supabase/migrations/20260910120200_raahi_shared_demand_bridge_projections.sql");
const design = read("docs/RAAHI_SHARED_DEMAND_BRIDGE_DESIGN_V1.md");
const routes = ["src/app/api/shared/start/route.ts", "src/app/api/shared/match/route.ts"].map(read).join("\n");
const errors = read("src/lib/shared-api.ts");

describe("Raahi Shared — Passenger-originated demand bridge", () => {
  it("keeps explicit Shared requests distinct from ordinary Travel Interests", () => {
    expect(schema).toContain("intent_kind in ('INTEREST','SHARED_REQUEST')");
    expect(schema).toContain("default 'INTEREST'");
    expect(schema).toContain("intent_kind\n)\nwhere status='ACTIVE'");
    expect(commands).toContain("'SHARED_REQUEST'");
    expect(commands).toContain("'creates_booking',false");
  });

  it("does not create a booking merely by starting a shared ride", () => {
    const start = commands.slice(commands.indexOf("private.start_shared_ride"), commands.indexOf("private.accept_shared_trip_match"));
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
  });

  it("makes Shared match rows browser-inaccessible canonical state", () => {
    expect(schema).toContain("create table public.shared_trip_matches");
    expect(schema).toContain("shared_trip_matches_no_direct_client_access");
    expect(schema).toContain("using(false) with check(false)");
    expect(schema).toContain("revoke all on table public.shared_trip_matches from anon,authenticated");
  });

  it("matches exact route and requested time-window demand FIFO", () => {
    expect(schema).toContain("t.origin_location_id=v_o.origin_location_id");
    expect(schema).toContain("t.destination_location_id=v_o.destination_location_id");
    expect(schema).toContain("v_o.departure_at between t.desired_departure_at and t.desired_window_end_at");
    expect(schema).toContain("order by t.created_at,t.id");
    expect(schema).toContain("for update of t skip locked");
  });

  it("uses one live Driver-ready offer per Passenger Shared request", () => {
    expect(schema).toContain("uq_shared_trip_matches_live_intent");
    expect(schema).toContain("where status='OFFERED'");
    expect(schema).toContain("unique(travel_intent_id,offering_id)");
  });

  it("expires and releases protected seats through a canonical locked helper", () => {
    expect(schema).toContain("release_expired_shared_trip_holds");
    expect(schema).toContain("where id=p_offering_id for update");
    expect(schema).toContain("set held_seats=held_seats-v_match.seat_count");
    expect(schema).toContain("status='EXPIRED'");
  });

  it("releases live holds when either the request or trip closes", () => {
    expect(schema).toContain("release_shared_holds_on_intent_close");
    expect(schema).toContain("release_shared_holds_on_trip_close");
    expect(schema).toContain("'NOT_CONFIRMED','DRIVER_CANCELLED','EXPIRED','IN_FULFILMENT','COMPLETED'");
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

  it("blocks Product-OFF Shared discovery and new Passenger commitments", () => {
    expect(schema).toContain("private.product_feature_enabled(v_o.product_id)");
    expect(commands).toContain("private.product_feature_enabled(p.id)");
    expect(commands).toContain("private.product_feature_enabled(v_o.product_id)");
    expect(projections).toContain("filter_enabled_trip_discovery");
    expect(design).toContain("OFF means no new discovery");
  });

  it("keeps Shared mutations idempotent and behind RPC APIs", () => {
    expect(commands).toContain("claim_user_command('start_shared_ride'");
    expect(commands).toContain("claim_user_command('accept_shared_trip_match'");
    expect(commands).toContain("claim_user_command('decline_shared_trip_match'");
    expect(routes).toContain('supabase.rpc("start_shared_ride"');
    expect(routes).toContain('"accept_shared_trip_match"');
    expect(routes).toContain('"decline_shared_trip_match"');
    expect(routes).not.toContain(".from(");
  });

  it("keeps customer-facing API errors in Raahi Shared language", () => {
    expect(errors).toContain("Raahi Shared is not available");
    expect(errors).toContain("Driver offer");
    expect(errors).not.toContain("threshold");
    expect(errors).not.toContain("CARPOOL");
  });
});
