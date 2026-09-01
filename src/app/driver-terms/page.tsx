import Link from 'next/link';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';

export default function DriverTermsPage() {
  return <LegalDocumentPage
    title="Driver Terms"
    version="2026-08-31-v1"
    intro="These additional terms apply to a Driver using Raahi. They supplement the general Terms of Service and Privacy Policy and are accepted before the first protected Driver operation."
  >
    <section>
      <h2>1. Driver eligibility and responsibility</h2>
      <p>You must be legally entitled to drive and provide the relevant transport service, and must keep every licence, registration, permit, insurance, fitness, tax, pollution or other document required for you and the vehicle valid for the work you undertake.</p>
      <p>Raahi coordinates demand and digital operations. You remain responsible for actually driving the vehicle, complying with traffic and transport law and deciding whether you can safely undertake a trip. Nothing in these Driver Terms removes any statutory obligation that applies to Raahi under applicable aggregator or transport law.</p>
    </section>

    <section>
      <h2>2. Accurate onboarding and verification</h2>
      <ul>
        <li>Provide genuine and current Driving Licence, vehicle RC, vehicle details and car photographs requested by Raahi.</li>
        <li>Do not submit another person’s document or use another Driver’s verified account.</li>
        <li>Tell Raahi promptly if a licence, RC, permit, insurance or other material document expires, is suspended, cancelled, transferred or materially changes.</li>
        <li>Use only a vehicle that Raahi has associated with your current Driver account where the service requires vehicle linkage.</li>
        <li>Raahi may pause Driver operations while verification is incomplete, expired, disputed or under review.</li>
      </ul>
    </section>
    <section>
      <h2>3. Shared Ride FIFO and route operations</h2>
      <p>Shared Ride uses route-specific operational controls. If you join a route queue, you agree to follow Raahi’s FIFO and trip-state rules for that route.</p>
      <ul>
        <li>Join only from a valid current location/stand and do not deliberately misstate your location.</li>
        <li>Do not manipulate queue position, create duplicate Driver identities, coordinate fake activity or use another person to hold your place.</li>
        <li>Do not join another queue while an incompatible active trip or queue state exists.</li>
        <li>Follow the active-trip controls honestly, including trip start, stop progression, passenger/payment state and completion.</li>
        <li>Outstation preferences are independent from Shared Ride FIFO; selecting Outstation areas does not create or alter a Shared Ride queue position.</li>
      </ul>
    </section>

    <section>
      <h2>4. Shared Ride fares and Passenger payment</h2>
      <p>For Shared Ride, Raahi may configure and show a fare per seat for the active trip. You must not misrepresent that displayed fare or demand an undisclosed mandatory amount as a condition of completing the ride.</p>
      <p>Unless Raahi clearly introduces another payment method, the Passenger pays you directly. Where the service requires you to confirm payment, use that control only after you have actually received the relevant payment.</p>
    </section>

    <section>
      <h2>5. Outstation leads and quotes</h2>
      <ul>
        <li>Enable only pickup/service areas you genuinely intend to serve.</li>
        <li>Quote only where you are reasonably able and willing to perform the trip using an eligible vehicle.</li>
        <li>Your quote must state a genuine total amount and accurately identify whether tolls and parking are included.</li>
        <li>Do not use a low or misleading quote to obtain the Passenger’s contact details and then impose undisclosed mandatory charges.</li>
        <li>Once a Passenger accepts your quote, communicate promptly and use their contact details only for the accepted trip, safety or support.</li>
      </ul>
    </section>
    <section>
      <h2>6. Safety and zero tolerance</h2>
      <ul>
        <li>Never drive while under the influence of alcohol, illegal drugs or any substance that makes driving unsafe.</li>
        <li>Do not drive when dangerously fatigued, medically unfit or otherwise unable to control the vehicle safely.</li>
        <li>Obey applicable speed, seat-belt, helmet, passenger-capacity, child-safety and other road-safety requirements.</li>
        <li>Do not overload the vehicle or accept a trip that cannot be safely served because of passenger count, luggage, vehicle condition, road/weather conditions or another material risk.</li>
        <li>Do not carry weapons, contraband or unlawful goods, or knowingly assist a Passenger in unlawful activity.</li>
        <li>Report a serious safety incident, accident or material complaint to Raahi as soon as reasonably possible after immediate emergency needs are addressed.</li>
      </ul>
    </section>

    <section>
      <h2>7. Passenger treatment and non-discrimination</h2>
      <p>Treat Passengers respectfully. Do not harass, threaten, intimidate, sexually harass, discriminate unlawfully, retaliate against a complainant, or condition transport on an unrelated personal favour.</p>
      <p>Reasonable service refusal may be appropriate where a trip is unsafe, unlawful, materially misrepresented or beyond the capacity of the vehicle. Any refusal should not be based on an unlawful discriminatory ground.</p>
    </section>

    <section>
      <h2>8. Cancellations and no-shows</h2>
      <p>If you cannot safely or lawfully serve an accepted trip, cancel or inform the Passenger promptly. Repeated avoidable cancellations, no-shows, false availability or deliberately accepting work you do not intend to perform may lead to reduced access, restriction or deactivation.</p>
      <p>Where a Passenger fails to appear or a payment problem occurs, use Raahi’s available status/support controls honestly rather than fabricating an event or attempting retaliation.</p>
    </section>
    <section>
      <h2>9. Passenger privacy</h2>
      <p>Passenger phone numbers, pickup details, destinations, trip notes and live/location information are provided only for legitimate trip coordination, safety and support. Do not retain, publish, sell, scrape, share or reuse Passenger information for unrelated marketing, personal contact or solicitation without a separate lawful basis and the Passenger’s appropriate consent.</p>
      <p>If you receive a shared-trip link or other sensitive trip information, protect it from unnecessary disclosure.</p>
    </section>

    <section>
      <h2>10. Vehicle condition and presentation</h2>
      <p>Keep the vehicle reasonably clean, safe and consistent with the vehicle identity shown in Raahi. Do not substitute a materially different vehicle without updating Raahi and obtaining any review required by the service.</p>
      <p>Maintain tyres, brakes, lights, seat belts and other safety-critical equipment as required by law and manufacturer guidance. A Raahi verification badge does not replace your continuing duty to keep the vehicle roadworthy.</p>
    </section>

    <section>
      <h2>11. GPS, device and operational accuracy</h2>
      <p>Where Raahi uses your device for current stand, active-trip GPS or operational progress, keep location permissions and connectivity enabled as reasonably necessary for the feature. Do not spoof GPS, falsify stop progression or deliberately create misleading trip state.</p>
      <p>You are responsible for using the Driver interface safely. Do not interact with the phone in a way that violates traffic law or distracts you while driving.</p>
    </section>

    <section>
      <h2>12. Complaints, audits and cooperation</h2>
      <p>Raahi may investigate a complaint, verification concern, queue irregularity, accident, safety issue or payment dispute. You agree to provide reasonably requested information and not destroy or fabricate relevant records.</p>
      <p>Raahi may temporarily restrict Driver operations during a serious safety or verification investigation. Where applicable law requires a specific inquiry, notice or appeal process, that process takes precedence over any inconsistent part of these Driver Terms.</p>
    </section>
    <section>
      <h2>13. Relationship with Raahi</h2>
      <p>Raahi’s intended operating model is that Drivers provide transport independently rather than as employees of Raahi. These Driver Terms do not authorize you to bind Raahi, make promises on Raahi’s behalf or represent yourself as Raahi staff.</p>
      <p>If applicable law characterizes the relationship differently or imposes employment, social-security, welfare, insurance, licensing or aggregator obligations despite this intended model, those legal obligations are not waived by this clause.</p>
    </section>

    <section>
      <h2>14. Platform charges and Driver earnings</h2>
      <p>Raahi does not charge Drivers a platform commission at launch. Unless Raahi clearly introduces another arrangement, the Driver receives transportation payment directly from the Passenger.</p>
      <p>Raahi may introduce lawful fees or commissions prospectively after clear notice and any consent or contractual update required by law. A later fee change will not silently alter an already accepted Outstation quote or active Shared Ride fare.</p>
    </section>

    <section>
      <h2>15. Restriction or deactivation</h2>
      <p>Raahi may restrict or deactivate Driver access for expired/false verification, unsafe driving, intoxication, serious complaints, fraud, repeated no-shows, queue manipulation, misuse of Passenger data, abusive conduct, legal/regulatory requirements or other material breach.</p>
      <p>Immediate temporary suspension may be appropriate where continuing access could create a safety or fraud risk. Where law requires investigation, notice, reasons, hearing or reinstatement procedures, Raahi will follow those requirements.</p>
    </section>

    <section>
      <h2>16. Applicable law and your own compliance</h2>
      <p>You are responsible for understanding the laws and permits applicable to the transport you personally provide. Raahi may provide operational rules or reminders, but does not give you legal or tax advice.</p>
      <p>Nothing here reduces any obligation imposed on Raahi itself by the Motor Vehicles Act, State transport rules, Motor Vehicle Aggregator Guidelines where applicable, consumer law, privacy law or other mandatory law.</p>
    </section>
    <section>
      <h2>17. General Terms, Privacy and updates</h2>
      <p>The general <Link href="/terms" className="font-bold text-primary underline">Terms of Service</Link> and <Link href="/privacy" className="font-bold text-primary underline">Privacy Policy</Link> also apply. If these Driver Terms conflict with the general Terms on a Driver-specific operational issue, these Driver Terms control to the extent of that issue, subject always to mandatory law.</p>
      <p>Material updates may require a new acceptance before you can next join Shared Ride FIFO or send an Outstation quote. Historic acceptance records may be retained for audit and legal purposes.</p>
    </section>
  </LegalDocumentPage>;
}
