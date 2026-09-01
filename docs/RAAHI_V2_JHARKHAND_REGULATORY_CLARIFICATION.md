# Raahi 2.0 — Jharkhand Regulatory Clarification Note

**Purpose:** obtain a practical written clarification for a small, locally built mobility platform before public paid ride transactions are enabled.

**Current posture:** Raahi is in a controlled pilot. The website may be publicly reachable for browsing, account creation, Driver recruitment and verification, but public Passenger↔Driver ride transactions are disabled by a database-level launch switch. Only named acceptance-testing accounts can use transactional functions.

## What Raahi is

Raahi is a local mobility coordination platform intended for towns and corridors that are poorly served by large formal mobility platforms.

It currently has two mobility modes:

1. **Shared Ride:** route-based local travel. A verified Driver joins a route-specific FIFO queue, an active vehicle/trip becomes available, and Passengers may request available seats at configured pickup points and displayed fares.
2. **Outstation:** a Passenger states pickup area, exact pickup, destination, date/time and passenger count. Eligible Drivers who have opted into that pickup area may independently submit a total quote. The Passenger may select one quote.

Raahi does not collect the transportation fare at launch. The Passenger pays the Driver directly, and Raahi charges no platform commission at launch.

## Controls already built

Raahi already supports authenticated roles, verified mobile numbers for Passenger booking, Driver Driving Licence/RC/car-photo review, private verification documents, route capacity controls, exact-seat concurrency, route-specific FIFO, GPS/trip state, staged contact disclosure, support/audit records, Terms/Privacy acceptance and account restriction.
Before a Driver can perform paid pilot operations, Raahi now separately requires Admin verification of:

- commercial/permitted passenger-service vehicle classification;
- current vehicle permit;
- fitness certificate;
- motor insurance; and
- Pollution Under Control (PUC) record.

Private/non-transport vehicles are recorded but remain transaction-disabled unless the applicable legal position is later confirmed to permit that model.

## Why clarification is requested

Jharkhand’s published **Jharkhand On-Demand Transportation Technology Aggregator Rules, 2019** apply to aggregators operating in the State and define the licensing authority as the State Transport Authority. The Government of India subsequently issued the **Motor Vehicle Aggregator Guidelines, 2025** under section 93 of the Motor Vehicles Act.

Raahi seeks to comply before enabling public paid ride transactions, but needs confirmation of which present State framework and operating requirements apply to this small local model.

## Questions for the Transport Department / STA

1. Are the Jharkhand On-Demand Transportation Technology Aggregator Rules, 2019 still the operative licensing framework in Jharkhand after the Motor Vehicle Aggregator Guidelines, 2025?
2. Has Jharkhand adopted, partially adopted, or begun administratively applying the 2025 Guidelines?
3. Does the fleet threshold published in the 2019 Rules (including the stated minimum for motor cabs) still apply to a new applicant?
4. Is there any current provision for a small local pilot, phased licence, sandbox or limited-area approval before reaching that fleet threshold?
5. For Shared Ride, may a permitted contract-carriage/motor-cab vehicle carry separate passengers who reserve individual seats along a configured corridor through Raahi? If yes, what permit conditions should Raahi verify?
6. May any private/non-transport four-wheeler lawfully be used for paid Shared Ride pooling through a platform in Jharkhand? Raahi currently keeps such vehicles transaction-disabled pending clarification.
7. For Outstation trips, is a separate source-district aggregator licence/approval still required under the 2019 framework, or can one State-level licence cover the service under the current position?
8. Which vehicle permit category should Raahi require for Shared Ride and Outstation respectively?
9. What are the current application fee, licence fee, security/bank-guarantee requirement and any minimum-fleet requirement for a new applicant?
10. Which safety, Driver verification, insurance, training, grievance and data/API requirements must be completed before the Department would permit public operation?

## Proposed low-risk pilot posture

Until written clarification is received, Raahi proposes to keep public ride transactions disabled. The live website would be used for product testing, Driver recruitment/verification and Passenger browsing. A small named acceptance-testing group may exercise the transaction workflow only for controlled product acceptance, not public promotion or open commercial availability.

Raahi is willing to adjust vehicle eligibility, permit checks, onboarding, safety controls and launch scope to the Department’s guidance before enabling public transactions.

## Current official contacts (checked 1 September 2026)

Jharkhand Transport Department lists **Shri Sanjeev Kumar Besra, Transport Commissioner**, phone **0651-2446802**, email **tc-jharkhand@jharkhandmail.gov.in**. The Department also publishes `dtohelpdeskjharkhand@gmail.com` and `spermitjhr@gmail.com` for helpdesk/permit matters.

Primary official references:

- Jharkhand On-Demand Transportation Technology Aggregator Rules, 2019: https://transport.jharkhand.gov.in/pdf/678_2_2019.pdf
- Motor Vehicles Aggregator Guidelines, 2025: https://morth.nic.in/sites/default/files/circulars_document/MV-Aggregators-Guidelines-2025%20-%20English%20and%20Hindi.pdf
- Jharkhand Transport contact directory: https://transport.jharkhand.gov.in/contact-details.html
## Suggested email

**Subject:** Request for clarification — small local mobility platform (Raahi) under Jharkhand Aggregator Rules / MVAG 2025

Respected Sir,

We are building Raahi, a small local mobility coordination platform for Shared Ride routes and Driver-quoted Outstation travel in Jharkhand. Before enabling public paid ride transactions, we want to confirm the current licensing and vehicle-permit requirements applicable to our model.

Raahi is presently maintained as a controlled product pilot: public ride transactions are disabled, Drivers can register and submit compliance documents, and only named acceptance-testing accounts can exercise transactional flows for software testing. We have attached/provided a short note describing the model and ten specific questions, including the current status of the 2019 Jharkhand Aggregator Rules after the 2025 Central Guidelines and whether the published fleet threshold still applies.

We would be grateful for guidance on the applicable licensing authority/process and the requirements we should satisfy before opening the service to the public. We are willing to adapt the launch scope and vehicle eligibility to the Department’s direction.

Regards,
Raahi project team
[CONTACT NAME]
[PHONE]
[EMAIL]
