import Link from 'next/link';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';

export default function PrivacyPage() {
  return <LegalDocumentPage
    title="Privacy Policy"
    version="2026-08-31-v1"
    intro="This Policy explains how Raahi uses personal data to provide identity, Shared Ride, Outstation, Driver verification, safety, location, support and related local-mobility features. It should be read with the Terms of Service."
  >
    <section>
      <h2>1. Who is responsible for your data</h2>
      <p>The operator of Raahi is responsible for deciding how personal data is used for the Raahi service. The final legal entity name, address and privacy/grievance contact must be inserted before public launch. Until then, privacy questions can be submitted through Contact Raahi.</p>
      <p>Raahi intends to follow the Digital Personal Data Protection Act, 2023 and applicable rules as their provisions become applicable, together with other privacy, consumer and transport-related obligations that apply to the service.</p>
    </section>

    <section>
      <h2>2. Data Raahi may collect or receive</h2>
      <ul>
        <li>Google sign-in identity, account identifier, display name, email and authentication/session information.</li>
        <li>Mobile number, phone-verification status and related authentication events.</li>
        <li>Role information, account status, restrictions, preferences and service settings.</li>
        <li>Shared Ride routes, pickup stops, seat selections, booking states, fare snapshots and trip/service events.</li>
        <li>Outstation pickup area, exact pickup text, destination, dates, passenger count, notes, Driver quotes and accepted-booking details.</li>
        <li>Driver profile, vehicle details and verification material such as Driving Licence, RC and car photographs.</li>
        <li>GPS/location and time data where used for current stand, active-trip operations, live location, route progress or safety features.</li>
        <li>Support cases, complaints, contact messages, audit/security events and records needed to investigate misuse or service problems.</li>
      </ul>
    </section>
    <section>
      <h2>3. How Raahi obtains data</h2>
      <p>Data may come directly from you, from your device, from your Google authentication session, from Drivers/Passengers interacting with the same trip, from Raahi Admin review, or from service providers used for hosting, authentication, messaging, maps and related infrastructure.</p>
      <p>Raahi does not ask users to upload Driver verification documents into public profile fields. Sensitive verification files are handled through restricted verification workflows.</p>
    </section>

    <section>
      <h2>4. Why Raahi uses personal data</h2>
      <ul>
        <li>authenticate users and maintain one operational role per account;</li>
        <li>verify phone numbers and protect transactional actions from fake or abusive use;</li>
        <li>coordinate Shared Ride seats, routes, FIFO, trip progress and payment/booking state;</li>
        <li>match Outstation requests to eligible Drivers and show/accept quotes;</li>
        <li>review Driver and vehicle verification and display appropriate trust indicators;</li>
        <li>provide location-based trip features and safety/support functions;</li>
        <li>prevent fraud, abuse, queue manipulation, unauthorized access and other misuse;</li>
        <li>respond to support, complaints, disputes, legal requests and regulatory obligations; and</li>
        <li>measure aggregate service health and improve local mobility reliability.</li>
      </ul>
    </section>

    <section>
      <h2>5. Legal basis and consent</h2>
      <p>Where applicable law requires consent, Raahi will seek clear consent for the relevant processing and record it where appropriate. Some processing may instead be necessary to provide a service you requested, comply with law, protect users, prevent fraud, respond to emergencies, or rely on another basis permitted by applicable law.</p>
      <p>Accepting the Terms does not mean you consent to every imaginable use of your data. Raahi should provide separate notice or consent where the law requires it for a materially different purpose.</p>
    </section>
    <section>
      <h2>6. Contact sharing and visibility</h2>
      <p>Raahi follows a stage-based privacy model. Contact details are not intended to be broadly visible before they are operationally needed.</p>
      <ul>
        <li>For Outstation, Driver and Passenger phone details are intended to become visible after a Driver quote is accepted.</li>
        <li>Passengers may see Driver name, vehicle details, verification status and approved car photographs as part of trust and booking decisions.</li>
        <li>Licence and RC scans are not shown to passengers merely because a Driver is verified.</li>
        <li>Drivers may see pickup/destination and other request information needed to decide whether to serve a lead, subject to the privacy boundaries built into the service.</li>
        <li>Shared-trip links may expose limited trip/location information to the person holding a valid link until the link expires or is revoked.</li>
      </ul>
    </section>

    <section>
      <h2>7. Location and GPS</h2>
      <p>Raahi may use location for current-stand selection, route eligibility, active-trip GPS, Passenger trip progress, shared-trip safety features and aggregate local-demand understanding. Location data may be approximate or delayed.</p>
      <p>Raahi’s launch policy is not to build unrelated individualized advertising profiles from a person’s trip or location history. Aggregate, de-identified or privacy-aware mobility insights may be used to improve service planning, understand corridor demand and decide where Raahi should expand, subject to applicable law.</p>
    </section>

    <section>
      <h2>8. Service providers</h2>
      <p>Raahi may use service providers for cloud/database infrastructure, authentication, hosting, maps, communications/OTP transport, monitoring and other operational functions. Providers should receive only the access reasonably needed for their function and be subject to contractual/security controls appropriate to the data involved.</p>
      <p>Where personal data is processed outside India or across jurisdictions, Raahi will comply with transfer restrictions and other requirements that apply at the relevant time.</p>
    </section>
    <section>
      <h2>9. When Raahi may disclose data</h2>
      <p>Raahi may disclose information to another Passenger or Driver where the service stage requires it; to service providers operating Raahi; to law-enforcement, courts, regulators or other authorities where legally required; or where reasonably necessary to investigate fraud, protect safety, respond to an emergency or establish/defend legal claims.</p>
      <p>Raahi does not sell personal data to advertisers. Local Offers may be shown without giving the advertiser a Passenger’s individual trip history or contact details unless the user separately chooses to contact that business.</p>
    </section>

    <section>
      <h2>10. Retention</h2>
      <p>Raahi keeps personal data only for as long as reasonably needed for the purpose for which it was collected and for safety, dispute handling, fraud prevention, audit, legal, accounting or regulatory requirements. Different categories may have different retention periods.</p>
      <p>Active-trip GPS should not be retained indefinitely merely because it was collected. Verification and transaction records may need longer retention where they support legal, safety or audit obligations. Counsel should confirm the final retention schedule before scale-up.</p>
    </section>

    <section>
      <h2>11. Security</h2>
      <p>Raahi uses technical and operational safeguards intended to limit unauthorized access, including authenticated role boundaries, restricted document access, server-side business rules, audit history and environment/secret controls. No internet service can guarantee absolute security.</p>
      <p>If Raahi becomes aware of a personal-data breach, it will investigate and make notices or reports required by applicable law.</p>
    </section>

    <section>
      <h2>12. Your privacy choices and rights</h2>
      <p>Depending on applicable law and the stage of its commencement, you may have rights relating to access to information, correction, completion, erasure, withdrawal of consent, grievance redressal and nomination or other statutory rights.</p>
      <p>Requests can be made through <Link href="/contact" className="font-bold text-primary underline">Contact Raahi</Link> until a dedicated privacy channel is published. Raahi may need to verify the requester’s identity. Some information may be retained despite a deletion request where lawfully necessary for safety, fraud prevention, legal claims, audit or another permitted purpose.</p>
    </section>
    <section>
      <h2>13. Children</h2>
      <p>Raahi is not designed for independent transactional use by a person who is not legally competent to make the relevant arrangement. Where a child travels, a responsible adult should make and supervise the arrangement as required by law.</p>
      <p>If Raahi later introduces a feature specifically directed to children, schools or guardians, that feature should have its own privacy and consent controls rather than relying only on this general Policy.</p>
    </section>

    <section>
      <h2>14. Local Offers and analytics</h2>
      <p>Raahi may measure aggregate usage, route demand, service-area activity and feature performance to improve the service and support Raahi’s local economic model. Local Offers may be contextual to a place or service area without creating an individualized advertising profile from a user’s private trip history.</p>
      <p>If Raahi later introduces materially different advertising, tracking or personalization, this Policy and any required consent controls should be updated before that use begins.</p>
    </section>

    <section>
      <h2>15. Changes to this Policy</h2>
      <p>Material changes will be identified by a new policy version. Raahi may require acknowledgement of the new version before the next protected Passenger or Driver transaction. Historic acceptance timestamps may be retained as audit evidence.</p>
    </section>

    <section>
      <h2>16. Privacy and grievance contact</h2>
      <p><strong>Pre-launch details to complete:</strong> [LEGAL ENTITY / PROPRIETOR NAME], [PRIVACY OR GRIEVANCE OFFICER], [EMAIL], [PHONE] and [BUSINESS ADDRESS]. These details must be completed before public launch and aligned with the Terms of Service.</p>
      <p>Until then, use <Link href="/contact" className="font-bold text-primary underline">Contact Raahi</Link> for privacy questions or requests.</p>
    </section>
  </LegalDocumentPage>;
}
