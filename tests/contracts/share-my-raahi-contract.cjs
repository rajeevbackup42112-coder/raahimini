const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260822211500_v2_beta2_share_my_raahi.sql'), 'utf8');
const sharedPage = fs.readFileSync(path.join(root, 'src/app/shared-trip/page.tsx'), 'utf8');
const shareButton = fs.readFileSync(path.join(root, 'src/components/ShareMyRaahiButton.tsx'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(migration.includes('token_hash text not null unique'), 'share tokens must be stored as hashes');
must(migration.includes("extensions.digest(convert_to(v_token,'UTF8'),'sha256')"), 'share-token hashing missing');
must(!migration.includes(' token text '), 'plaintext token column must not exist');
must(migration.includes("v_request.status<>'CONFIRMED'"), 'share creation must require a confirmed booking');
must(migration.includes('passenger_id=auth.uid()'), 'passenger ownership check missing');
must(migration.includes('create or replace function public.revoke_trip_share_link'), 'revocation RPC missing');
must(migration.includes("new.status='COMPLETED'"), 'completion expiry behavior missing');
must(migration.includes("new.status='CANCELLED'"), 'cancelled-trip expiry behavior missing');
must(migration.includes('grant execute on function public.get_shared_trip(text) to anon, authenticated'), 'read-only public shared projection missing');

const publicProjection = migration.slice(migration.indexOf('create or replace function public.get_shared_trip'), migration.indexOf('create or replace function public.expire_trip_share_links_on_terminal_state'));
must(!/phone/i.test(publicProjection), 'shared projection must not expose phone data');
must(!publicProjection.includes('update public.'), 'shared read projection must not mutate state');

must(sharedPage.includes('Shared trip · read only'), 'shared page must state read-only scope');
must(sharedPage.includes('No phone numbers or Raahi booking history are shared.'), 'shared page privacy promise missing');
must(shareButton.includes('Revoke this link'), 'passenger revoke control missing');
must(shareButton.includes('only this trip'), 'one-trip scope copy missing');

console.log('Share My Raahi contract: PASS');
