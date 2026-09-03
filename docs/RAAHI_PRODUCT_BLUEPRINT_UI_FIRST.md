# Raahi Product Blueprint — UI First

Status: Product-design prototype. No backend implementation is authorized by this document.

## Product thesis

Raahi is a local mobility network for towns and corridors poorly served by formal transport platforms.

The product should feel like one marketplace, not a collection of ride modes. A Passenger enters **From + To**. Raahi decides what experience fits the journey.

Expansion loop:

**Add origin area → onboard Drivers → serve Outstation → observe demand → promote proven corridors → densify Shared Ride.**

## 1. Passenger experience

### One travel search

Passengers should not have to understand “Shared Ride” versus “Outstation” before planning travel.

1. Passenger enters origin and destination.
2. If the journey matches a published fixed corridor, Raahi offers Shared Ride seats.
3. If no fixed corridor matches and the origin is an active Outstation area, Raahi offers an Outstation quote request.
4. If neither is available, Raahi should capture useful demand without pretending supply exists.

This keeps product complexity inside Raahi rather than pushing it onto the Passenger.

## 2. Shared Ride

Shared Ride is the density engine.

Launch model:

- Fixed origin and destination.
- Repeatable seat-level travel rather than whole-car hire.
- FIFO Driver rotation.
- Exact-seat concurrency must remain enforced.
- Drivers explicitly choose which published corridor(s) they want to serve.
- A Driver can be operationally active on only the corridor they are physically serving at that time.
- Shared Ride preferences do not subscribe a Driver to Outstation work.

Initial high-confidence corridors remain:

- Dhanbad ⇄ Gomoh
- Parasnath → Madhuban

Do not add flexible intermediate-stop logic in the UI-first phase. Revisit that only after the fixed-corridor experience is proven.

## 3. Outstation

Outstation is the supply-acquisition and demand-discovery engine.

Launch model:

- Raahi onboards **origin areas/cities**, not destination pairs.
- Passenger destination may be flexible.
- Outstation is **round trip only** for this launch model.
- One-way intercity demand should not be forced into Outstation when the Driver's return journey is uncertain.
- If a city pair becomes repeatedly dense, Admin can investigate promoting it into a fixed Shared Ride corridor.
- Drivers choose the Outstation origin areas they serve.
- Only verified eligible Drivers subscribed to the request's origin area should receive the lead.
- Driver may quote or ignore.
- Passenger compares eligible quotes and chooses.

Shared Ride route preferences and Outstation origin-area preferences remain independent networks.

## 4. Driver self-onboarding

Driver supply must scale without making Admin the data-entry bottleneck.

Public product entry: **Drive with Raahi**.

Driver flow:

1. Continue with Google.
2. Verify mobile number by OTP.
3. See the one-time plain-language Raahi acceptance screen.
4. Add Driver photo.
5. Upload Driving Licence.
6. Upload Vehicle RC.
7. Upload car photos — front, rear and interior at minimum.
8. Add any operating/compliance documents required by the real launch policy.
9. Choose base/origin area from areas already onboarded by Raahi.
10. Submit for review.
11. Admin reviews, rejects individual items if necessary, or approves.
12. After approval, Driver chooses Shared Ride corridor and/or Outstation origin-area preferences.

Admin's job is **verification and marketplace quality**, not creating Driver accounts manually.

## 5. Trust and legal acceptance

Trust should be visible in the booking decision, not hidden in settings.

### First-time acceptance

After sign-in + phone OTP, show a short readable “Welcome to Raahi” summary once.

Principles for that screen:

- Raahi connects Passengers and independent Drivers.
- People still make their own travel decisions.
- Raahi verifies submitted details but cannot eliminate all travel risk.
- Fares/booking terms are shown in the relevant flow.
- Everyone must follow applicable traffic, permit and safety rules.
- Misuse can be reported.
- Full Terms / Privacy / Driver Terms remain linked for complete legal text.

The short summary does not replace the full legal documents or versioned acceptance ledger.

### Outstation trust card

Before Passenger acceptance, show:

- Driver photo.
- Driver name.
- Vehicle model.
- Actual submitted car photos.
- DL verified badge.
- RC verified badge.
- Other meaningful verification/compliance badges that are truthful for that Driver.
- Quote and inclusions.

Do not show the Driver's actual licence/RC document images to Passengers.

Contact details stay private until the intended post-acceptance stage.

## 6. Local information and future promotions

Local Offers should support the journey rather than behave like banner inventory.

Early launch — before paid advertisers:

- community events / festival notes;
- relevant travel information;
- destination/origin suggestions when useful;
- Raahi feedback / support prompt.

Future paid promotion:

- contextual to origin, destination or journey intent;
- tightly capped;
- never interrupt core booking;
- clearly marked **Sponsored**;
- dismissible / non-coercive;
- business self-registration may be considered later, with Admin approval.

The product goal is **useful local discovery**, not maximum ad impressions.

## 7. Admin operating model

Admin should see marketplace health, not just database records.

Useful operating signals:

- active Outstation origin areas;
- verified Drivers by area;
- pending Driver verifications;
- Shared Ride corridors and active/waiting Driver supply;
- Shared Ride demand served / unserved;
- Outstation requests and quote-response rate;
- repeated origin-destination demand;
- suggested future corridor opportunities;
- local-information / promotion status.

A corridor suggestion is a decision aid, not an automatic route creation rule.

## 8. Demo design principle

The Raahi demo should behave like the School Transport demo: the viewer **does things** and watches the whole marketplace react.

It should not be seven disconnected vignettes.

Target demo story:

1. Admin starts with an empty market.
2. Admin publishes the first Raahi Area, Shared Ride corridors and Outstation origin areas.
3. Driver self-onboards.
4. Driver accepts plain-language terms.
5. Driver submits identity, car and origin area.
6. Admin approves.
7. Driver chooses service preferences.
8. Passenger enters a fixed-corridor journey and Raahi offers Shared Ride.
9. FIFO/seat behavior becomes visible.
10. Passenger enters a non-corridor journey and Raahi offers round-trip Outstation automatically.
11. Eligible origin-area Drivers receive the lead and quote/ignore.
12. Passenger compares trust cards and accepts.
13. Contact + trip lifecycle unlock at the intended stage.
14. Community information appears without interrupting booking.
15. Admin sees demand-derived next-corridor learning.

All demo state is synthetic and browser-local. No Supabase table/RPC/auth mutation should be required for the UI-first prototype.

## 9. Implementation gate

Do **not** wire these changes into production backend logic until:

1. the complete prototype is clickable;
2. desktop and mobile visual review is complete;
3. Passenger, Driver and Admin flows feel coherent;
4. edge states are reviewed;
5. product owner approves the experience;
6. only then is a backend implementation plan produced.

The UI prototype is allowed to change aggressively. Production safety invariants are not.
