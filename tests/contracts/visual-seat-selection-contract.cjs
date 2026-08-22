const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function expect(source, fragment, message) {
  if (!source.includes(fragment)) throw new Error(message);
}

const migration = read('supabase/migrations/20260822181500_v2_beta1_visual_seat_selection.sql');
const statusMigration = read('supabase/migrations/20260822181700_v2_beta1_visual_seat_status.sql');
const api = read('src/lib/raahiApi.ts');
const booking = read('src/app/request-seat-screen/components/RequestSeatContent.tsx');
const resume = read('src/app/resume-seat-request/page.tsx');
const status = read('src/app/request-status-screen/components/RequestStatusContent.tsx');

expect(migration, 'p_seat_numbers integer[] default null', 'request_seats must keep optional explicit seat selection');
expect(migration, "seat_number=any(p_seat_numbers)", 'request_seats must lock the passenger-selected seat numbers');
expect(migration, "and state='AVAILABLE'", 'selected seats must still be AVAILABLE at reservation time');
expect(migration, "'seats',coalesce(v_seats,'[]'::jsonb)", 'public car projection must expose anonymous seat state');
expect(migration, 'v_written<>p_seat_count', 'seat ledger write count must remain all-or-nothing');
expect(statusMigration, "'seat_numbers',v_seat_numbers", 'passenger status must retain authoritative seat numbers');
expect(api, 'seatNumbers?:number[]', 'client booking API must accept explicit selected seats');
expect(api, 'p_seat_numbers:seatNumbers?.length?seatNumbers:null', 'client must send selected seats to the canonical RPC');
expect(booking, 'Choose your seats', 'booking UI must render visual seat selection');
expect(booking, 'selectedSeats', 'booking UI must track explicit seat choices');
expect(booking, 'requestSeats(effectiveTripId, selectedStopId, selectedSeats.length, selectedSeats)', 'booking UI must reserve the exact chosen seats');
if (booking.includes('Number of Seats')) throw new Error('Legacy seat-count picker must not replace visual seat selection');
expect(resume, 'raahi_pending_seat_numbers', 'sign-in resume flow must preserve exact selected seats');
expect(resume, 'requestSeats(tripId, stopId, seatCount, seatNumbers)', 'resume flow must reserve the preserved seat selection');
expect(status, 'req.seat_numbers', 'My Ride must show authoritative seat numbers');

console.log('visual seat selection contract: PASS');
