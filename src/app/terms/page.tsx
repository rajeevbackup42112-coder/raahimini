import Link from 'next/link';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';

export default function TermsPage() {
  return <LegalDocumentPage
    title="Terms of Service"
    version="2026-08-31-v1"
    intro="These Terms govern use of Raahi for Shared Ride, Outstation and related mobility-coordination features. Please read them carefully. Browsing is open; you must accept the current Terms and Privacy Policy before your first transactional Passenger action."
  >
    <section>
      <h2>1. About these Terms</h2>
      <p>These Terms form an electronic agreement between you and the operator of the Raahi service. “Raahi”, “we”, “us” and “our” refer to the legal person operating Raahi, whose final legal name, registered address and grievance details must be inserted in Section 25 before public launch.</p>
      <p>By accepting these Terms, creating or using an account, requesting a seat, creating or accepting an Outstation booking, or otherwise using a transactional feature, you agree to these Terms and the Privacy Policy. Drivers are also bound by the separate Driver Terms.</p>
    </section>

    <section>
      <h2>2. Plain-language summary</h2>
      <ul>
        <li>Raahi is designed to coordinate local mobility between Passengers and Drivers; Raahi does not itself drive the vehicle used for an independent Driver trip.</li>
        <li>Shared Ride fares and Outstation quotes are shown before you commit. Unless Raahi clearly states otherwise, payment is made directly to the Driver.</li>
        <li>Driver verification is a trust control, not a guarantee of driving conduct, vehicle condition or trip outcome.</li>
        <li>Availability depends on real local supply. Raahi does not guarantee that a Driver, vehicle, seat or quote will always be available.</li>
        <li>Raahi is not an emergency service. In an emergency, contact the appropriate police, ambulance, fire or other emergency service.</li>
      </ul>
    </section>
    <section>
      <h2>3. Eligibility and accounts</h2>
      <ul>
        <li>You must be at least 18 years old and legally competent to enter into a contract to make a booking, accept a quote, operate as a Driver or otherwise transact through Raahi.</li>
        <li>A minor may travel only where the arrangement is lawfully made and supervised by a responsible adult. Raahi does not independently undertake guardianship or supervision of minors.</li>
        <li>You must provide accurate account information and must not impersonate another person, create deceptive accounts or permit another person to operate through your account where doing so would bypass Raahi’s role, verification or safety controls.</li>
        <li>You are responsible for maintaining control of your Google account, verified phone and device. Tell Raahi promptly if you believe your account has been compromised.</li>
        <li>Passenger booking actions require a verified mobile number. Driver access is subject to Raahi’s Driver onboarding, verification and operational controls.</li>
      </ul>
    </section>

    <section>
      <h2>4. Raahi’s role</h2>
      <p>Raahi provides software, identity, coordination, verification, dispatch, demand, support and related digital features intended to help local Passengers and Drivers find and coordinate with one another. A Driver who provides transport remains responsible for operating the vehicle and performing the trip in accordance with applicable law.</p>
      <p>Nothing in these Terms is intended to override a legal classification or statutory obligation that applies to Raahi, a Driver, a vehicle owner or a Passenger under the Motor Vehicles Act, applicable State rules, consumer law or any other applicable law. If applicable law treats Raahi as an aggregator or imposes duties on Raahi despite the functional description above, those duties remain unaffected.</p>
    </section>
    <section>
      <h2>5. Shared Ride service</h2>
      <p>Shared Ride is a route-based service. Raahi may show active routes, pickup points, Driver/vehicle information, live seat availability, configured fare per seat, estimated arrival information and trip progress. Information can change as the trip progresses.</p>
      <ul>
        <li>A seat request is subject to live availability. Where Raahi offers exact-seat selection, the requested seats are held together or the request fails; Raahi does not intentionally partially fulfil an exact-seat request.</li>
        <li>A HELD seat is not the same as a completed journey. Confirmation follows the booking/payment state shown in Raahi.</li>
        <li>Raahi may prevent booking at a pickup point already passed by the Driver or where the trip is no longer accepting requests.</li>
        <li>Drivers may be coordinated through route-specific FIFO. Passengers do not choose or alter a Driver’s FIFO position.</li>
        <li>Route fares may be configured by Raahi and snapshotted for an active trip so later fare-setting changes do not silently alter the amount already shown for that trip.</li>
      </ul>
    </section>

    <section>
      <h2>6. Outstation service</h2>
      <p>An Outstation request tells eligible Drivers that a Passenger is seeking transport from a Raahi service area to a stated destination. It is a lead, not a confirmed booking.</p>
      <ul>
        <li>Passengers must provide a reasonably accurate pickup area, exact pickup point, destination, travel date/time, passenger count and any material trip information.</li>
        <li>Eligible Drivers may independently choose whether to respond and may provide a total quote with stated toll/parking inclusions and a note.</li>
        <li>A booking is created only when the Passenger selects an available Driver quote. Other outstanding quotes may then close.</li>
        <li>The accepted quote is evidence of the quoted amount and stated inclusions at acceptance. Any later change should be mutually agreed and clearly communicated.</li>
        <li>Raahi may limit the number of open requests, quote validity, capacity or service areas to protect marketplace quality and safety.</li>
      </ul>
    </section>
    <section>
      <h2>7. Fares, payments and platform charges</h2>
      <p>Unless Raahi expressly introduces and identifies an in-app payment method, transportation payment is made directly between Passenger and Driver. Raahi does not receive, hold or settle that ride fare merely because the fare or quote is displayed in the service.</p>
      <ul>
        <li>Shared Ride: the fare shown for the active trip is the fare Raahi expects the Passenger to pay for the selected seat(s), subject to any lawful correction clearly disclosed before confirmation.</li>
        <li>Outstation: the accepted Driver quote controls the quoted total, subject to the toll, parking and other inclusions displayed with that quote.</li>
        <li>Passengers should not be required to pay undisclosed mandatory charges. Drivers should not misrepresent a fare displayed or accepted through Raahi.</li>
        <li>Raahi is free/no-platform-commission at launch. Raahi may introduce lawful fees, commissions or paid features later only with clear prospective notice; existing accepted bookings will not be silently repriced by a later platform-fee change.</li>
        <li>Each party remains responsible for taxes, permits, accounting or other financial obligations that legally apply to that party.</li>
      </ul>
    </section>

    <section>
      <h2>8. Driver and vehicle verification</h2>
      <p>Raahi uses verification controls to improve trust. Depending on the feature, these may include review of Driving Licence, vehicle Registration Certificate (RC), vehicle details and car photographs.</p>
      <p>A “verified” status means that Raahi recorded the relevant material as verified under its then-current process. Verification does not guarantee future validity, driving skill, roadworthiness, legal compliance, personal conduct, identity beyond the checks performed, or a particular trip outcome. Raahi may re-review, suspend or revoke verification where documents expire, information changes, complaints arise or further checks are reasonably required.</p>
    </section>

    <section>
      <h2>9. Contact details and trip information</h2>
      <p>Raahi limits personal contact sharing until it is operationally needed. For Outstation, Passenger and Driver phone details are intended to become available after a quote is accepted. Shared Ride contact and trip information may be exposed according to the booking state and service need.</p>
      <p>You may use another user’s phone number, pickup details, trip information or shared-trip link only for legitimate ride coordination, safety or support. You must not sell, publish, scrape, spam, profile or reuse such information for unrelated marketing or harassment.</p>
    </section>
    <section>
      <h2>10. Location, GPS and live trip features</h2>
      <p>Some Raahi features depend on location. Drivers may be asked to declare a current stand or share operational GPS during an active trip. Passengers may receive route progress, Driver-location or shared-trip information where Raahi makes that available.</p>
      <ul>
        <li>Location information may be delayed or inaccurate because of device settings, network conditions, GPS limitations, mapping data or user error.</li>
        <li>Drivers must not deliberately falsify operational location or trip progress.</li>
        <li>A Passenger must not use location or shared-trip information to stalk, threaten or unlawfully track another person.</li>
        <li>Live-trip sharing is a coordination/safety aid and is not a substitute for emergency services or personal judgment.</li>
      </ul>
    </section>

    <section>
      <h2>11. Cancellations, no-shows and changes of plan</h2>
      <p>Passengers and Drivers should cancel or communicate promptly if plans change. Repeated false bookings, speculative requests, avoidable no-shows, deliberate last-minute disruption or misuse of cancellation tools may lead to warnings, restrictions or account suspension.</p>
      <p>At launch, Raahi does not itself promise a refund for money paid directly to a Driver. Where a payment dispute arises, Raahi may review its service records and facilitate communication. Any statutory refund or consumer right that legally applies remains unaffected.</p>
    </section>

    <section>
      <h2>12. Safety responsibilities</h2>
      <ul>
        <li>Passengers and Drivers must comply with applicable traffic, seat-capacity and safety requirements.</li>
        <li>Do not ask or pressure a Driver to speed, overload a vehicle, take an unlawful route, drive while impaired, or otherwise operate unsafely.</li>
        <li>Drivers must not drive while under the influence of alcohol, drugs or any substance that makes driving unsafe, or while dangerously fatigued or medically unfit to drive.</li>
        <li>Users should use reasonable judgment before entering a vehicle or proceeding with a trip. If identity, vehicle or conduct materially differs from what Raahi shows, do not proceed and report the issue.</li>
        <li>For immediate danger or a medical, police or fire emergency, contact the appropriate emergency authority first.</li>
      </ul>
    </section>
    <section>
      <h2>13. Prohibited conduct</h2>
      <p>You must not use Raahi to:</p>
      <ul>
        <li>commit or facilitate fraud, theft, violence, trafficking, harassment, discrimination or any other unlawful act;</li>
        <li>submit false ride requests, false quotes, fake complaints, misleading identity/vehicle information or forged verification material;</li>
        <li>circumvent account, phone, role, verification, capacity, FIFO, route, pricing or safety controls;</li>
        <li>interfere with Raahi’s systems, scrape non-public data, probe security without permission, introduce malicious code or overload the service;</li>
        <li>use another person’s personal information for unrelated solicitation, retaliation or commercial profiling; or</li>
        <li>use Raahi in a way that creates an unreasonable risk to another user, Driver, passenger, vehicle or the public.</li>
      </ul>
    </section>

    <section>
      <h2>14. Local Offers and third-party promotions</h2>
      <p>Raahi may show Local Offers, sponsored local promotions or partner information. Unless expressly stated otherwise, the promoted business is responsible for its own goods, services, prices, availability and claims. A promotion does not make Raahi the seller of that third party’s product or service.</p>
      <p>Raahi should identify sponsored/promotional material as appropriate and does not use individual trip/location histories to build unrelated advertising profiles under the launch privacy model.</p>
    </section>

    <section>
      <h2>15. Support, complaints and service records</h2>
      <p>Users may contact Raahi about safety, verification, payment disputes, abuse, technical issues or suggestions. Raahi may review account, booking, trip, audit and support records reasonably relevant to a complaint and may ask the parties for additional information.</p>
      <p>Raahi may take interim protective action—including restricting an account or Driver access—where reasonably necessary for safety, fraud prevention or preservation of service integrity. Where applicable law requires a particular grievance, complaint or inquiry process, Raahi will follow that process.</p>
    </section>
    <section>
      <h2>16. Privacy and data use</h2>
      <p>Raahi’s <Link href="/privacy" className="font-bold text-primary underline">Privacy Policy</Link> explains the personal data used for authentication, phone verification, ride coordination, Driver verification, GPS/location features, safety, support and service operation. The Privacy Policy forms part of these Terms.</p>
      <p>Where consent is the appropriate legal basis, Raahi will seek it in the manner required by applicable law. Where another lawful basis applies, nothing in these Terms is intended to convert that processing into consent unnecessarily. Privacy rights and statutory obligations cannot be waived by these Terms.</p>
    </section>

    <section>
      <h2>17. Third-party services and connectivity</h2>
      <p>Raahi depends on third-party services such as identity/authentication, hosting, maps, messaging/OTP transport, device operating systems and telecommunications networks. Those services may be unavailable, inaccurate or subject to their own terms.</p>
      <p>Raahi will use reasonable care in selecting and operating integrations, but cannot guarantee uninterrupted availability of systems outside its control. You remain responsible for compatible device access, connectivity and any charges imposed by your telecom or internet provider.</p>
    </section>

    <section>
      <h2>18. Account restriction, suspension and termination</h2>
      <p>Raahi may restrict, suspend or terminate access where reasonably necessary because of suspected fraud, unsafe conduct, legal/regulatory requirements, repeated no-shows, verification failure, abuse, material breach of these Terms or risk to other users or the service.</p>
      <p>Where appropriate and lawful, Raahi may provide a reason or an opportunity to clarify the issue. Immediate protective action may be taken first where delay could create a safety, fraud or security risk. Ending an account does not erase obligations or records that must lawfully be retained.</p>
    </section>

    <section>
      <h2>19. Service availability and changes</h2>
      <p>Raahi may add, remove, pause or change routes, service areas, features, marketplace rules or operating hours. Local mobility is supply-dependent, and no minimum Driver response, quote count, waiting time, trip frequency or seat availability is guaranteed.</p>
      <p>Planned changes should not retroactively alter an already accepted Outstation quote or silently change a fare snapshotted for an active Shared Ride, except where a correction is legally required or the parties expressly agree.</p>
    </section>
    <section>
      <h2>20. Intellectual property</h2>
      <p>Raahi’s software, brand, interface, original text, graphics and service design are owned by or licensed to the operator of Raahi, except for third-party material and user-provided content. Subject to these Terms, Raahi grants you a limited, personal, non-transferable and revocable right to use the service for its intended purpose.</p>
      <p>You may not copy, reverse engineer, resell, falsely brand, commercially exploit or create a confusingly similar service from protected Raahi material except where applicable law expressly permits it.</p>
    </section>

    <section>
      <h2>21. Disclaimers</h2>
      <p>Raahi will use reasonable care in operating the coordination service and its trust controls. However, to the extent permitted by law, Raahi does not warrant that every Driver will respond, every trip will occur exactly as planned, every estimated time or map position will be exact, or every third-party system will remain uninterrupted.</p>
      <p>Raahi’s verification, matching, demand, GPS, queue and support features reduce certain risks but cannot eliminate the ordinary risks of road travel or human conduct. Nothing in this section limits any warranty, consumer protection or statutory duty that cannot lawfully be excluded.</p>
    </section>

    <section>
      <h2>22. Responsibility and limitation of liability</h2>
      <p>Each Driver remains responsible for driving and vehicle operation; each Passenger remains responsible for lawful and reasonable conduct during the journey. To the extent permitted by applicable law, Raahi is not responsible merely because a loss arises from the independent acts or omissions of a Driver, Passenger or unrelated third party.</p>
      <p>Raahi remains responsible for its own obligations under applicable law. Nothing in these Terms excludes or limits liability where exclusion is prohibited, including liability arising from fraud, wilful misconduct, or any other liability that applicable law requires to remain available.</p>
      <p>To the extent permitted by law, Raahi will not be liable for remote, indirect or consequential losses that were not reasonably foreseeable from Raahi’s own breach. Consumer remedies available under applicable law remain unaffected.</p>
    </section>

    <section>
      <h2>23. Your responsibility for claims caused by misuse</h2>
      <p>If your unlawful, fraudulent or deliberate misuse of Raahi causes a third-party claim, regulatory action or direct loss to Raahi, you are responsible for that loss to the extent permitted by law and to the extent it was actually caused by your conduct. This clause does not require a consumer to indemnify Raahi for Raahi’s own negligence, statutory breach or misconduct.</p>
    </section>
    <section>
      <h2>24. Force majeure and events outside reasonable control</h2>
      <p>Raahi is not responsible for delay or failure caused by events outside its reasonable control, such as severe weather, floods, road closures, civil disturbance, government action, telecom or cloud outages, widespread power failure, strikes, natural disaster or other comparable events. Raahi will use reasonable efforts to restore affected service when practical.</p>
    </section>

    <section>
      <h2>25. Changes to these Terms</h2>
      <p>Raahi may update these Terms to reflect product, safety, legal or operational changes. Material changes will be identified by a new version and may require you to accept the updated Terms before your next protected Passenger or Driver transaction.</p>
      <p>Changes apply prospectively unless applicable law requires otherwise. An update to these Terms does not silently alter an accepted fare, quote or other completed transaction.</p>
    </section>

    <section>
      <h2>26. Governing law, consumer rights and disputes</h2>
      <p>These Terms are governed by the laws of India. Nothing in these Terms restricts a Passenger’s right to approach a competent consumer commission, regulator, court or other authority where such a right exists under applicable law.</p>
      <p>Before formal proceedings, we encourage users to contact Raahi so we can review the service record and attempt a practical resolution. Subject to any mandatory consumer or statutory forum, the final city/state jurisdiction for ordinary contractual disputes must be confirmed by counsel and inserted before public launch.</p>
    </section>

    <section>
      <h2>27. Legal notices and grievance contact</h2>
      <p><strong>Pre-launch legal details to complete:</strong> [LEGAL ENTITY / PROPRIETOR NAME], [REGISTERED OR PRINCIPAL BUSINESS ADDRESS], [GRIEVANCE OFFICER NAME/DESIGNATION], [GRIEVANCE EMAIL], [GRIEVANCE PHONE], and [FINAL JURISDICTION CITY/STATE].</p>
      <p>Until those details are inserted, product/support messages can be sent through <Link href="/contact" className="font-bold text-primary underline">Contact Raahi</Link>. This placeholder must not remain in the public-launch legal document.</p>
    </section>

    <section>
      <h2>28. General provisions</h2>
      <ul>
        <li>If one provision is held invalid or unenforceable, the remaining provisions continue to the extent permitted by law.</li>
        <li>A delay in enforcing a provision is not automatically a waiver of that provision.</li>
        <li>You may not transfer your account or contractual rights in a way that bypasses Raahi’s identity, role or safety controls.</li>
        <li>Raahi may reorganize or transfer operation of the service to a lawful successor, subject to applicable notice and data-protection obligations.</li>
        <li>These Terms, the Privacy Policy, applicable Driver Terms and transaction-specific information shown in Raahi form the relevant agreement for use of the service.</li>
      </ul>
    </section>
  </LegalDocumentPage>;
}
