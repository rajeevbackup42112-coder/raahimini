const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };
const migration = read('supabase/migrations/20260830111500_demo_ready_driver_route_preferences_parasnath.sql');
const screen = read('src/app/driver-route-selection/components/DriverRouteSelectionContent.tsx');
const card = read('src/app/driver-route-selection/components/DriverRouteCard.tsx');
const api = read('src/lib/raahiApi.ts');

must(migration.includes('create table if not exists public.driver_route_preferences'), 'route preference table missing');
must(migration.includes('unique(driver_id, route_family_id)'), 'route preferences must be unique per Driver/family');
must(migration.includes("'PM-01'"), 'Parasnath to Madhuban route code missing');
must(migration.includes("'Parasnath → Madhuban'"), 'Parasnath to Madhuban direction missing');
must(migration.includes("values(v_route,1,'Parasnath',0),(v_route,2,'Madhuban',46)"), 'Parasnath route must have explicit endpoint timing');
must(migration.includes('order by q.joined_at desc'), 'existing Drivers should inherit only their most recent served route');
must(migration.includes('get_my_driver_route_preferences'), 'Driver preference read RPC missing');
must(migration.includes('set_my_driver_route_preference'), 'Driver preference mutation RPC missing');
must(migration.includes("r.is_current=true and r.version_status='PUBLISHED' and r.is_active=true"), 'preferences must resolve to the current active route version');
must(migration.includes('Active Driver access required'), 'preference writes must require an active Driver');
must(!/update\s+public\.driver_queue/i.test(migration), 'route preferences must not mutate FIFO queue state');
must(!/update\s+public\.trips/i.test(migration), 'route preferences must not mutate trip state');
must(!/update\s+public\.seat_requests/i.test(migration), 'route preferences must not mutate passenger booking state');
must(api.includes('getMyDriverRoutePreferences'), 'client route preference read helper missing');
must(api.includes('setMyDriverRoutePreference'), 'client route preference write helper missing');
must(screen.includes('preferences.some(pref => pref.route_id === route.route_id)'), 'route cards must reflect saved alert preference');
must(screen.includes('preferenceByRouteId.get(event.route_id)'), 'demand events must be filtered by route subscription');
must(screen.includes("label: 'View route'"), 'off-stand subscribed demand should offer route navigation');
must(screen.includes('setLocationId(preference.from_location_id)'), 'route alert should navigate to the subscribed origin');
must(card.includes('Demand alerts'), 'Driver route card must expose demand alert preference');
must(card.includes("subscribed ? 'On for this route' : 'Off — no demand alerts'"), 'Driver route card must explain alert state');
must(card.includes('<article'), 'route card must use a non-button container when it contains separate actions');
must(card.includes('onToggleSubscription'), 'route card must keep alert toggle separate from queue join');

console.log('Driver route preferences + Parasnath route contract: PASS');
