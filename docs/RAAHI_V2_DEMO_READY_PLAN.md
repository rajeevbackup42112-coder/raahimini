# Raahi 2.0 — Demo Ready / Investor Polish Plan

Updated: 2026-08-29
Branch: `demo-ready-investor-polish`
Baseline: final accepted V14 + post-acceptance docs checkpoint `2d89539257e301a2a5a78c6507199c5ef5a326c8`

## Objective

Make Raahi feel like a confident, investable mobility product without weakening or changing the accepted transport engine.

Demo Ready means an investor should understand the product quickly, trust the experience, and see operational depth without feeling that they are looking at an internal operations tool.

## Non-negotiable boundary

This track is UI/UX, information hierarchy, brand, copy, responsive polish and demo storytelling only unless a separate functional change is explicitly approved and regression-tested.

Do not alter backend FIFO, canonical trip lifecycle, seat ownership, real-GPS requirements, phone verification, auth boundaries, privacy rules, production test-auth protections or raw operational-state mutation rules.

The accepted V14 runtime and `prod-v14-frozen` remain untouched until the Demo Ready candidate passes the full existing contract/build/role acceptance gates.

## Design direction

Raahi should feel local, warm, trustworthy and premium—not like a generic SaaS dashboard, a government portal or an Uber clone.

Keep the existing deep-green identity and warm neutral foundation. Improve hierarchy, spacing, typography, elevation, icon treatment, live-state expression, transitions and visual storytelling before adding decorative complexity.

Use one dominant action per mobile state. Keep operational detail progressively disclosed. Remove repeated explanatory copy where the visual hierarchy can communicate the same thing.

Live states should feel alive through restrained motion and freshness cues, never through fabricated data.

## Investor-demo test

Every important screen should answer three questions immediately:

1. What is happening now?
2. What should this user do next?
3. What makes Raahi meaningfully better or safer than an informal shared-seat process?

## Screen audit order

| Order | Surface | Demo objective |
|---:|---|---|
| 1 | Public / Passenger Home | Strong first impression; explain Raahi in seconds; surface live supply clearly |
| 2 | Login / identity | Trustworthy, simple, intentional single-entry authentication |
| 3 | Active car / route detail | Make live availability, fare, driver and next action instantly legible |
| 4 | Seat selection | Make exact-seat ownership feel tangible and premium |
| 5 | Passenger ride status | Best-in-class journey certainty; pickup, driver, status and next action |
| 6 | Passenger live map | Investor “wow” moment while remaining truthful about freshness/staleness |
| 7 | Share My Raahi | Trust/privacy story should be visually obvious |
| 8 | Driver Home / route selection | Make economics + operating choice obvious without dashboard clutter |
| 9 | Driver collecting car | Manifest and pickup workflow should feel calm, fast and professional |
| 10 | Driver in-progress / arrival | Minimal driving-state UI with unambiguous next action |
| 11 | Admin Dashboard | Demonstrate operating leverage and route health, not table density |
| 12 | Admin Users | Professional identity/role-management experience |
| 13 | Admin Routes | Guarded operational control with clear version/state hierarchy |
| 14 | Admin Operations / Support | Exception-first command center with high signal-to-noise |
| 15 | Profile / Help / empty / error states | No neglected screens; consistent trust and finish everywhere |

## Audit dimensions

For every screen capture desktop and mobile where applicable and score: first-glance comprehension, visual hierarchy, brand strength, action clarity, trust/safety, information density, copy quality, spacing/alignment, responsive behavior, loading/empty/error states, motion/feedback and demo impact.

Classify findings as `KEEP`, `POLISH`, `REDESIGN`, or `REMOVE`.

## Initial code-level findings

The current design system is a good foundation but still reads as a polished functional app rather than a distinctive premium product. The deep green / warm-neutral palette should stay.

The public Home uses a generic gradient hero plus a grid of locations and repeated explanatory route cards. The hierarchy is clear, but it spends too much vertical space explaining mechanics rather than creating a memorable live-mobility first impression.

The Passenger bottom navigation exposes four equally weighted destinations (`Routes`, `Live Ride`, `My Ride`, `Profile`). This is understandable but can make the experience feel feature-oriented rather than state-oriented; visual audit should determine whether the active-journey state can carry more of the navigation burden.

The header is clean but utilitarian. Brand mark, location context, role context and account treatment can be refined without adding clutter.

Repeated labels such as `What happens next`, `Next`, and explanatory safety copy are useful for acceptance clarity but should be consolidated where hierarchy can communicate the same message with less visual noise.

The existing restrained animation utilities are a good base. Demo polish should add purposeful state transitions and live/freshness cues, not decorative motion.

## Demo-state rule

Do not fake production GPS or operational state. Investor demos should use a controlled non-production/demo environment or real accepted flows. Any synthetic presentation layer must be clearly non-operational and must never bypass canonical backend rules.

## Release gate

No Demo Ready UI is production-ready merely because it looks better. Before any deployment it must retain 28/28 contract pass, TypeScript pass, production build pass, protected-role behavior, responsive role acceptance, FIFO, exact seats, real GPS, lifecycle completion, privacy/revoke and cleanup invariants.
