'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BellRing,
  Building2,
  BusFront,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  FileCheck2,
  Gauge,
  HeartHandshake,
  Home,
  Image as ImageIcon,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  RotateCcw,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Users,
} from 'lucide-react';
import BrandLockup from '@/components/ui/BrandLockup';

type Role = 'admin' | 'driver' | 'passenger';
type Tone = 'good' | 'warn' | 'quiet';

type StoryStep = {
  actor: Role;
  label: string;
  title: string;
  detail: string;
  action: string;
};

const STORY: StoryStep[] = [
  { actor: 'admin', label: 'Start', title: 'Start with an empty Raahi Area', detail: 'No public marketplace has to be fabricated. The operator decides where Raahi is ready to serve.', action: 'Create Raahi Area' },
  { actor: 'admin', label: 'Network', title: 'Publish the first mobility network', detail: 'Shared Ride launches only on known fixed corridors. Outstation launches by origin area, not by destination pair.', action: 'Publish pilot network' },
  { actor: 'driver', label: 'Join', title: 'A Driver joins Raahi himself', detail: 'Admin is no longer the data-entry bottleneck. The Driver starts from the public “Drive with Raahi” entry point.', action: 'Continue with Google' },
  { actor: 'driver', label: 'Trust', title: 'One-time plain-language acceptance', detail: 'After sign-in and phone OTP, Raahi explains the relationship in short readable language before onboarding continues.', action: 'I accept & continue' },
  { actor: 'driver', label: 'Profile', title: 'Driver submits identity, car and origin area', detail: 'Rajeev4 uploads his photo, DL, RC and vehicle photos, then chooses Bokaro as his Outstation origin area.', action: 'Submit for verification' },
  { actor: 'admin', label: 'Verify', title: 'Admin verifies; Admin does not create', detail: 'Ajit reviews the submission, can reject individual items, and approves only after the profile is complete.', action: 'Approve Driver' },
  { actor: 'driver', label: 'Services', title: 'Driver chooses where he wants work', detail: 'Outstation origin areas and Shared Ride corridor preferences stay independent. Raahi only sends relevant work.', action: 'Save service preferences' },
  { actor: 'passenger', label: 'Shared Ride', title: 'Passenger simply enters From and To', detail: 'Dhanbad → Gomoh matches a published fixed corridor, so Raahi offers a Shared Ride seat automatically.', action: 'Request 2 seats' },
  { actor: 'driver', label: 'FIFO', title: 'Shared Ride stays dense and fair', detail: 'Naresh is the active Driver; the next eligible Driver waits behind him. Passenger demand goes to the active car.', action: 'Confirm Shared Ride' },
  { actor: 'passenger', label: 'Outstation', title: 'A flexible trip becomes Outstation automatically', detail: 'Bokaro → Ranchi is not a Shared Ride corridor. Because Bokaro is an onboarded origin area, Raahi opens a round-trip quote request.', action: 'Request round-trip quotes' },
  { actor: 'driver', label: 'Quotes', title: 'Only Bokaro Drivers receive the lead', detail: 'Rajeev4 quotes ₹3,800. Another eligible Bokaro Driver can quote or ignore. Destination can be anywhere; origin eligibility drives routing.', action: 'Send ₹3,800 quote' },
  { actor: 'passenger', label: 'Choose', title: 'Passenger chooses with trust, not just price', detail: 'Before acceptance, Raahi shows Driver photo, actual car photos and verification badges. Contact details remain private.', action: 'Accept Rajeev4' },
  { actor: 'driver', label: 'Trip', title: 'Acceptance unlocks the operating relationship', detail: 'Contact becomes available at the intended stage. The trip can move through pickup, fresh GPS and completion.', action: 'Complete simulated trip' },
  { actor: 'passenger', label: 'Community', title: 'Useful local information before paid ads', detail: 'Raahi can show community updates, destination tips and a feedback/support prompt without interrupting booking.', action: 'See marketplace learning' },
  { actor: 'admin', label: 'Learn', title: 'Demand tells Raahi what to launch next', detail: 'Repeated Outstation demand becomes a corridor signal. Admin can promote a proven pair into Shared Ride when density justifies it.', action: 'Finish walkthrough' },
];

function toneClasses(tone: Tone) {
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-stone-200 bg-stone-50 text-stone-600';
}

function Pill({ children, tone = 'quiet' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${toneClasses(tone)}`}>{children}</span>;
}

function PhoneFrame({ role, title, children }: { role: Role; title: string; children: ReactNode }) {
  const label = role === 'admin' ? 'Ajit · Admin' : role === 'driver' ? 'Driver view' : 'Passenger view';
  return <div className="overflow-hidden rounded-[30px] border border-border bg-[#FAF9F6] shadow-xl">
    <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
      <BrandLockup size={28}/>
      <div className="text-right"><p className="text-xs font-extrabold">{label}</p><p className="text-[10px] text-muted-foreground">{title}</p></div>
    </div>
    <div className="min-h-[540px] p-4">{children}</div>
  </div>;
}

function EmptyNetwork({ advance }: { advance: () => void }) {
  return <PhoneFrame role="admin" title="Marketplace setup">
    <p className="section-label">Raahi Area</p><h2 className="mt-1 text-xl font-extrabold">Build your first local mobility network</h2>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Start with places where Raahi can actually recruit and verify Driver supply.</p>
    <div className="mt-5 rounded-2xl border border-dashed border-border bg-white p-5 text-center"><MapPin className="mx-auto text-muted-foreground"/><p className="mt-2 text-sm font-extrabold">No operating areas yet</p><p className="mt-1 text-xs text-muted-foreground">Add cities and corridors only when you are ready to operate them.</p></div>
    <button onClick={advance} className="btn-primary mt-5 w-full">Create Raahi Area <ArrowRight size={15}/></button>
  </PhoneFrame>;
}

function NetworkSetup({ advance }: { advance: () => void }) {
  return <PhoneFrame role="admin" title="Pilot network">
    <p className="section-label">Admin · Network</p><h2 className="mt-1 text-lg font-extrabold">Jharkhand pilot</h2>
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center gap-2"><Route size={17} className="text-primary"/><p className="text-sm font-extrabold">Shared Ride corridors</p></div><div className="mt-3 space-y-2 text-xs"><p className="rounded-xl bg-muted px-3 py-2">Dhanbad ⇄ Gomoh · ₹150 / seat</p><p className="rounded-xl bg-muted px-3 py-2">Parasnath → Madhuban · ₹150 / seat</p></div><p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Fixed origin + destination. Repeated seat pooling. FIFO Driver rotation.</p></div>
      <div className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center gap-2"><Car size={17} className="text-primary"/><p className="text-sm font-extrabold">Outstation origin areas</p></div><div className="mt-3 flex flex-wrap gap-2"><Pill tone="good">Bokaro</Pill><Pill>Dhanbad</Pill><Pill>Ranchi</Pill></div><p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Flexible destination. Round trip only for this launch model. Drivers subscribe by origin area.</p></div>
    </div>
    <button onClick={advance} className="btn-primary mt-5 w-full">Publish pilot network <ArrowRight size={15}/></button>
  </PhoneFrame>;
}

function DriverJoin({ stage, advance }: { stage: number; advance: () => void }) {
  if (stage === 2) return <PhoneFrame role="driver" title="Self-onboarding">
    <div className="rounded-2xl bg-secondary p-4"><p className="section-label">Drive with Raahi</p><h2 className="mt-1 text-xl font-extrabold">Earn from trips you choose</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Join Outstation origin areas, Shared Ride corridors, or both after verification.</p></div>
    <div className="mt-4 space-y-3"><div className="rounded-xl border border-border bg-white p-3"><p className="text-xs font-extrabold">1 · Continue with Google</p><p className="mt-1 text-[10px] text-muted-foreground">Use your normal Raahi identity.</p></div><div className="rounded-xl border border-border bg-white p-3"><p className="text-xs font-extrabold">2 · Verify mobile by OTP</p><p className="mt-1 text-[10px] text-muted-foreground">Raahi confirms a reachable mobile number.</p></div><div className="rounded-xl border border-border bg-white p-3"><p className="text-xs font-extrabold">3 · Add Driver + car details</p><p className="mt-1 text-[10px] text-muted-foreground">Admin reviews; Admin does not type the application for you.</p></div></div>
    <button onClick={advance} className="btn-primary mt-5 w-full">Continue with Google <ArrowRight size={15}/></button>
  </PhoneFrame>;

  return <PhoneFrame role="driver" title="Welcome to Raahi">
    <div className="flex items-center gap-2"><ShieldCheck className="text-primary" size={20}/><div><p className="section-label">One-time acceptance</p><h2 className="mt-1 text-lg font-extrabold">Simple rules before you continue</h2></div></div>
    <div className="mt-4 space-y-2">{[
      'Raahi connects Passengers and independent Drivers; it is not the Driver or vehicle owner.',
      'Travel only when the trip, vehicle and people feel right to you.',
      'Raahi verifies submitted Driver/vehicle details, but everyone must still use reasonable care.',
      'Fares are agreed for the trip and paid directly as shown in the booking flow.',
      'Follow traffic, permit and safety laws at all times.',
      'Report misuse or anything that makes the marketplace unsafe.',
    ].map(line=><div key={line} className="flex gap-2 rounded-xl bg-white p-3 text-xs leading-relaxed"><Check size={14} className="mt-0.5 shrink-0 text-primary"/><span>{line}</span></div>)}</div>
    <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Full Terms, Privacy and Driver Terms remain available for the complete legal text.</p>
    <button onClick={advance} className="btn-primary mt-5 w-full">I accept & continue <ArrowRight size={15}/></button>
  </PhoneFrame>;
}

function DriverApplication({ approved, advance }: { approved: boolean; advance: () => void }) {
  return <PhoneFrame role={approved ? 'admin' : 'driver'} title={approved ? 'Verification queue' : 'Driver application'}>
    <div className="flex items-center justify-between"><div><p className="section-label">{approved ? 'Admin review' : 'Your Driver profile'}</p><h2 className="mt-1 text-lg font-extrabold">Rajeev4 · Tata Tiago</h2></div><Pill tone={approved ? 'good' : 'warn'}>{approved ? 'READY TO APPROVE' : 'DRAFT'}</Pill></div>
    <div className="mt-4 grid grid-cols-2 gap-2"><MediaTile label="Driver photo"/><MediaTile label="Car · front"/><MediaTile label="Car · rear"/><MediaTile label="Car · interior"/></div>
    <div className="mt-3 space-y-2"><DocRow label="Driving licence"/><DocRow label="Vehicle RC"/><DocRow label="Insurance / operating docs"/></div>
    <div className="mt-3 rounded-xl border border-border bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Outstation origin area</p><div className="mt-2 flex items-center justify-between"><span className="text-sm font-extrabold">Bokaro</span><Pill tone="good">SELECTED</Pill></div></div>
    <button onClick={advance} className="btn-primary mt-5 w-full">{approved ? 'Approve Driver' : 'Submit for verification'} <ArrowRight size={15}/></button>
  </PhoneFrame>;
}

function MediaTile({ label }: { label: string }) {
  return <div className="flex min-h-[86px] flex-col items-center justify-center rounded-xl border border-border bg-muted text-center"><ImageIcon size={18} className="text-muted-foreground"/><p className="mt-2 text-[10px] font-extrabold">{label}</p><p className="text-[9px] text-muted-foreground">synthetic photo</p></div>;
}

function DocRow({ label }: { label: string }) {
  return <div className="flex items-center justify-between rounded-xl border border-border bg-white p-3"><div className="flex items-center gap-2"><FileCheck2 size={15} className="text-primary"/><span className="text-xs font-extrabold">{label}</span></div><Pill tone="good">UPLOADED</Pill></div>;
}

function ServicePreferences({ advance }: { advance: () => void }) {
  return <PhoneFrame role="driver" title="Where do you want work?">
    <div className="flex items-center justify-between"><div><p className="section-label">Services</p><h2 className="mt-1 text-lg font-extrabold">Choose your Raahi work</h2></div><Pill tone="good">VERIFIED</Pill></div>
    <div className="mt-4 space-y-3"><div className="rounded-2xl border-2 border-primary bg-secondary p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Car size={17}/><p className="text-sm font-extrabold">Outstation</p></div><CheckCircle2 size={18} className="text-primary"/></div><p className="mt-2 text-xs">Origin area · <strong>Bokaro</strong></p><p className="mt-1 text-[10px] text-muted-foreground">Receive round-trip quote leads originating in Bokaro.</p></div><div className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center gap-2"><Route size={17}/><p className="text-sm font-extrabold">Shared Ride</p></div><p className="mt-2 text-xs text-muted-foreground">Optional fixed-corridor subscriptions are independent of Outstation areas.</p></div></div>
    <button onClick={advance} className="btn-primary mt-5 w-full">Save service preferences <ArrowRight size={15}/></button>
  </PhoneFrame>;
}

function PassengerSearch({ outstation, advance }: { outstation: boolean; advance: () => void }) {
  return <PhoneFrame role="passenger" title="One travel search">
    <p className="section-label">Plan travel</p><h2 className="mt-1 text-xl font-extrabold">Where are you going?</h2>
    <div className="mt-4 space-y-2"><Field label="From" value={outstation ? 'Bokaro' : 'Dhanbad'}/><Field label="To" value={outstation ? 'Ranchi' : 'Gomoh'}/></div>
    <div className="mt-4 rounded-2xl border border-border bg-white p-4"><div className="flex items-start gap-3">{outstation?<Car size={20} className="mt-0.5 text-primary"/>:<BusFront size={20} className="mt-0.5 text-primary"/>}<div><p className="text-sm font-extrabold">{outstation ? 'Raahi Outstation' : 'Shared Ride available'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{outstation ? 'No fixed corridor matches this journey. Bokaro is an active Outstation origin area, so Raahi will ask verified local Drivers for a round-trip quote.' : 'This journey matches the Dhanbad → Gomoh fixed corridor. Book seats in the active car instead of hiring the whole vehicle.'}</p></div></div></div>
    {outstation ? <div className="mt-3 rounded-xl bg-amber-50 p-3"><p className="text-xs font-extrabold text-amber-900">Round trip</p><p className="mt-1 text-[10px] leading-relaxed text-amber-800">Outstation is round-trip only in this launch model because a return journey for the Driver is not guaranteed.</p></div> : <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary p-3"><span className="text-xs font-extrabold">2 seats · ₹300 total</span><Pill tone="good">₹150 / seat</Pill></div>}
    <button onClick={advance} className="btn-primary mt-5 w-full">{outstation ? 'Request round-trip quotes' : 'Request 2 seats'} <ArrowRight size={15}/></button>
  </PhoneFrame>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-white px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-extrabold">{value}</p></div>;
}

function SharedRideLive({ role, advance }: { role: Role; advance: () => void }) {
  if (role === 'driver') return <PhoneFrame role="driver" title="Shared Ride FIFO"><p className="section-label">Dhanbad → Gomoh</p><h2 className="mt-1 text-lg font-extrabold">Naresh is collecting</h2><div className="mt-4 rounded-2xl border-2 border-primary bg-secondary p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">ACTIVE_COLLECTING</p><Pill tone="good">#1</Pill></div><p className="mt-2 text-xs text-muted-foreground">2 Passenger seats requested · 2 seats remain.</p></div><div className="mt-3 rounded-xl border border-border bg-white p-3"><p className="text-xs font-extrabold">Next Driver</p><p className="mt-1 text-xs text-muted-foreground">Waiting behind active car · no queue jumping</p></div><button onClick={advance} className="btn-primary mt-5 w-full">Confirm Shared Ride <ArrowRight size={15}/></button></PhoneFrame>;
  return <PhoneFrame role="passenger" title="Shared Ride booking"><div className="flex items-center justify-between"><div><p className="section-label">Dhanbad → Gomoh</p><h2 className="mt-1 text-lg font-extrabold">Your seats are held</h2></div><Pill tone="good">2 SEATS</Pill></div><div className="mt-4 rounded-2xl border border-border bg-white p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><UserRound size={20}/></div><div><p className="text-sm font-extrabold">Naresh · active Driver</p><p className="mt-1 text-[10px] text-muted-foreground">Current collecting car · FIFO #1</p></div></div><div className="mt-3 flex gap-2"><Pill tone="good">DL VERIFIED</Pill><Pill tone="good">RC VERIFIED</Pill></div></div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Exact-seat controls prevent the car from being overbooked even when requests arrive together.</p></PhoneFrame>;
}

function OutstationLead({ advance }: { advance: () => void }) {
  return <PhoneFrame role="driver" title="Bokaro Outstation lead"><div className="flex items-center justify-between"><div><p className="section-label">New request</p><h2 className="mt-1 text-lg font-extrabold">Bokaro → Ranchi → Bokaro</h2></div><BellRing size={19} className="text-primary"/></div><div className="mt-4 grid grid-cols-2 gap-2"><Field label="Departure" value="Tomorrow · 7:00 AM"/><Field label="Passengers" value="4"/></div><div className="mt-3 rounded-xl border border-border bg-white p-3"><p className="text-xs font-extrabold">Why you received this</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">You are verified and subscribed to the Bokaro Outstation origin area. Your Shared Ride preferences do not affect this lead.</p></div><div className="mt-4 grid grid-cols-2 gap-2"><button className="btn-outline !py-2 text-xs">Ignore</button><button onClick={advance} className="btn-primary !py-2 text-xs">Quote ₹3,800</button></div></PhoneFrame>;
}

function TrustChoice({ advance }: { advance: () => void }) {
  return <PhoneFrame role="passenger" title="Compare verified local Drivers"><p className="section-label">2 quotes received</p><h2 className="mt-1 text-lg font-extrabold">Choose who you travel with</h2><div className="mt-4 rounded-2xl border-2 border-primary bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary"><UserRound size={24}/></div><div><p className="text-sm font-extrabold">Rajeev4</p><p className="text-[10px] text-muted-foreground">Tata Tiago · 4 seats</p></div></div><p className="text-lg font-extrabold">₹3,800</p></div><div className="mt-3 grid grid-cols-3 gap-2"><MediaTile label="Front"/><MediaTile label="Rear"/><MediaTile label="Inside"/></div><div className="mt-3 flex flex-wrap gap-2"><Pill tone="good">DL VERIFIED</Pill><Pill tone="good">RC VERIFIED</Pill><Pill tone="good">CAR PHOTOS</Pill></div><div className="mt-3 flex items-center gap-2 rounded-xl bg-muted p-3"><LockKeyhole size={14}/><p className="text-[10px] leading-relaxed">Phone/contact details stay private until you accept.</p></div><button onClick={advance} className="btn-primary mt-4 w-full">Accept Rajeev4</button></div><div className="mt-3 rounded-xl border border-border bg-white p-3"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold">Another verified Bokaro Driver</p><p className="mt-1 text-[10px] text-muted-foreground">Sedan · 4 seats</p></div><p className="text-sm font-extrabold">₹4,200</p></div></div></PhoneFrame>;
}

function TripLive({ advance }: { advance: () => void }) {
  return <PhoneFrame role="driver" title="Confirmed Outstation"><div className="flex items-center justify-between"><div><p className="section-label">Booking confirmed</p><h2 className="mt-1 text-lg font-extrabold">Bokaro → Ranchi → Bokaro</h2></div><Pill tone="good">ACCEPTED</Pill></div><div className="mt-4 space-y-2"><div className="rounded-xl border border-border bg-white p-3"><div className="flex items-center gap-2"><Phone size={15} className="text-primary"/><p className="text-xs font-extrabold">Passenger contact unlocked</p></div><p className="mt-1 text-[10px] text-muted-foreground">Only after quote acceptance.</p></div><div className="rounded-xl border border-border bg-white p-3"><div className="flex items-center gap-2"><Navigation size={15} className="text-primary"/><p className="text-xs font-extrabold">Fresh GPS · 18 m accuracy</p></div><p className="mt-1 text-[10px] text-muted-foreground">Simulated location for demo only.</p></div></div><div className="mt-4 flex items-center justify-between text-[10px] font-bold text-muted-foreground"><span>BOOKED</span><span>→</span><span>PICKUP</span><span>→</span><span>TRIP</span><span>→</span><span>COMPLETE</span></div><button onClick={advance} className="btn-primary mt-5 w-full">Complete simulated trip <ArrowRight size={15}/></button></PhoneFrame>;
}

function CommunitySurface({ advance }: { advance: () => void }) {
  return <PhoneFrame role="passenger" title="Around your trip"><div className="flex items-center gap-2"><Sparkles size={19} className="text-primary"/><div><p className="section-label">Useful, not intrusive</p><h2 className="mt-1 text-lg font-extrabold">Around your trip</h2></div></div><div className="mt-4 space-y-3"><InfoCard icon={<HeartHandshake size={16}/>} tag="COMMUNITY" title="Festival traffic note" detail="A local festival may make central Ranchi busier this evening. Plan a little extra time."/><InfoCard icon={<Store size={16}/>} tag="TRIP IDEA" title="Need sweets or gifts?" detail="Explore useful places near your origin or destination when you actually need them."/><InfoCard icon={<MessageSquareText size={16}/>} tag="RAAHI" title="Have a suggestion?" detail="Tell Raahi what would make local travel better. Feedback and support stay one tap away."/></div><p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">When paid local promotions arrive later, they should be limited, relevant to the journey and clearly marked Sponsored.</p><button onClick={advance} className="btn-primary mt-5 w-full">See marketplace learning <ArrowRight size={15}/></button></PhoneFrame>;
}

function InfoCard({ icon, tag, title, detail }: { icon: ReactNode; tag: string; title: string; detail: string }) {
  return <div className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center gap-2 text-primary">{icon}<p className="text-[9px] font-extrabold tracking-wider">{tag}</p></div><p className="mt-2 text-sm font-extrabold">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p></div>;
}

function LearningDashboard() {
  return <PhoneFrame role="admin" title="Marketplace health"><div className="flex items-center justify-between"><div><p className="section-label">Learn from demand</p><h2 className="mt-1 text-lg font-extrabold">What should Raahi launch next?</h2></div><Gauge size={20} className="text-primary"/></div><div className="mt-4 grid grid-cols-2 gap-2"><Metric value="3" label="Outstation origins"/><Metric value="2" label="Shared corridors"/><Metric value="2" label="Verified Bokaro Drivers"/><Metric value="18" label="Bokaro→Ranchi asks"/></div><div className="mt-4 rounded-2xl border-2 border-primary bg-secondary p-4"><div className="flex items-center gap-2"><Route size={17}/><p className="text-sm font-extrabold">Corridor opportunity</p></div><p className="mt-2 text-xs font-extrabold">Bokaro ⇄ Ranchi</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Repeated Outstation demand is becoming dense enough to investigate a fixed Shared Ride corridor. Data proposes; Admin decides.</p></div><div className="mt-4 rounded-xl border border-border bg-white p-3"><p className="text-xs font-extrabold">Expansion loop</p><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Add origin area → onboard Drivers → serve Outstation → observe demand → promote proven corridors → densify.</p></div></PhoneFrame>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl border border-border bg-white p-3"><p className="text-lg font-extrabold">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p></div>;
}

function RoleSummary({ role, stage, onClick }: { role: Role; stage: number; onClick: () => void }) {
  const active = STORY[stage].actor === role;
  const label = role === 'admin' ? 'Ajit · Admin' : role === 'driver' ? 'Drivers' : 'Passenger';
  const icon = role === 'admin' ? <Building2 size={15}/> : role === 'driver' ? <Car size={15}/> : <UserRound size={15}/>;
  let state = 'Waiting';
  if (role === 'admin') state = stage < 1 ? 'Empty network' : stage < 5 ? 'Network published' : stage < 14 ? 'Operating marketplace' : 'Learning from demand';
  if (role === 'driver') state = stage < 2 ? 'Join available' : stage < 4 ? 'Onboarding' : stage < 5 ? 'Pending review' : stage < 9 ? 'Verified' : stage < 11 ? 'Bokaro lead' : 'Booking won';
  if (role === 'passenger') state = stage < 7 ? 'Travel search ready' : stage < 9 ? 'Shared Ride' : stage < 11 ? 'Waiting for quotes' : stage < 13 ? 'Outstation booked' : 'Community + feedback';
  return <button onClick={onClick} className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-primary bg-secondary' : 'border-border bg-white hover:bg-muted'}`}><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2">{icon}<p className="text-xs font-extrabold">{label}</p></div>{active&&<CircleDot size={13} className="text-primary"/>}</div><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{state}</p></button>;
}

function renderSurface(stage: number, role: Role, advance: () => void) {
  if (stage === 0) return <EmptyNetwork advance={advance}/>;
  if (stage === 1) return <NetworkSetup advance={advance}/>;
  if (stage === 2 || stage === 3) return <DriverJoin stage={stage} advance={advance}/>;
  if (stage === 4) return <DriverApplication approved={false} advance={advance}/>;
  if (stage === 5) return <DriverApplication approved advance={advance}/>;
  if (stage === 6) return <ServicePreferences advance={advance}/>;
  if (stage === 7) return <PassengerSearch outstation={false} advance={advance}/>;
  if (stage === 8) return <SharedRideLive role={role} advance={advance}/>;
  if (stage === 9) return <PassengerSearch outstation advance={advance}/>;
  if (stage === 10) return <OutstationLead advance={advance}/>;
  if (stage === 11) return <TrustChoice advance={advance}/>;
  if (stage === 12) return <TripLive advance={advance}/>;
  if (stage === 13) return <CommunitySurface advance={advance}/>;
  return <LearningDashboard/>;
}

export default function DemoExperience() {
  const [stage, setStage] = useState(0);
  const [role, setRole] = useState<Role>('admin');
  const current = STORY[stage];

  const go = (next: number) => {
    const bounded = Math.max(0, Math.min(STORY.length - 1, next));
    setStage(bounded);
    setRole(STORY[bounded].actor);
  };
  const advance = () => go(stage + 1);

  return <main className="min-h-screen bg-[#F6F4EE] text-foreground">
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[11px] font-extrabold tracking-wide text-amber-900">RAAHI DEMO · SIMULATED MARKETPLACE · NO REAL RIDES OR LIVE DATA CHANGES</div>
    <header className="border-b border-border bg-white/95 px-4 py-4 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3"><div><BrandLockup size={36}/><p className="mt-1 text-xs text-muted-foreground">Build a local mobility network. Watch Passenger, Driver and Admin experiences change together.</p></div><div className="flex flex-wrap gap-2"><Pill tone="good">UI PROTOTYPE · BROWSER ONLY</Pill><Pill tone="warn">SAFE DEMO · NO LIVE CHANGES</Pill></div></div></header>

    <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[300px_minmax(0,1fr)_330px]">
      <aside className="min-w-0 rounded-3xl border border-border bg-white p-4 card-shadow xl:sticky xl:top-5 xl:h-fit"><p className="section-label">Build a Raahi Area</p><h1 className="mt-1 text-xl font-extrabold">One continuous marketplace story</h1><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Create supply, let Drivers join, serve Passenger demand, then learn which corridors deserve density.</p><div className="mt-4 max-h-[62vh] space-y-1 overflow-y-auto pr-1">{STORY.map((item,index)=><button key={item.label} onClick={()=>go(index)} className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left ${index===stage?'bg-secondary':'hover:bg-muted'}`}><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${index<stage?'bg-primary text-white':index===stage?'border-2 border-primary text-primary':'border border-border text-muted-foreground'}`}>{index<stage?<Check size={12}/>:index+1}</span><div><p className="text-xs font-extrabold">{item.title}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.label} · {item.actor}</p></div></button>)}</div></aside>

      <section className="min-w-0"><div className="mb-4 rounded-3xl border border-border bg-white p-5 card-shadow"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-label">Step {stage+1} of {STORY.length}</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight">{current.title}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{current.detail}</p></div><Pill tone="good">{current.actor.toUpperCase()} ACTION</Pill></div></div><div className="mx-auto max-w-[700px]">{renderSurface(stage, role, advance)}</div></section>

      <aside className="space-y-4 xl:sticky xl:top-5 xl:h-fit"><div className="rounded-3xl border border-border bg-white p-4 card-shadow"><p className="section-label">Live screens</p><h3 className="mt-1 text-sm font-extrabold">See what changed for everyone</h3><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">The same marketplace state drives all three views. Switch role without changing the story.</p><div className="mt-4 space-y-2"><RoleSummary role="admin" stage={stage} onClick={()=>setRole('admin')}/><RoleSummary role="driver" stage={stage} onClick={()=>setRole('driver')}/><RoleSummary role="passenger" stage={stage} onClick={()=>setRole('passenger')}/></div><div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-2"><button onClick={()=>go(stage-1)} disabled={stage===0} className="btn-outline !px-3 !py-2 text-xs"><ChevronLeft size={14}/>Back</button><button onClick={()=>go(0)} className="btn-outline !px-3 !py-2" aria-label="Reset demo"><RotateCcw size={14}/></button><button onClick={advance} disabled={stage===STORY.length-1} className="btn-primary !px-3 !py-2 text-xs">Next<ChevronRight size={14}/></button></div></div>

        <div className="rounded-3xl border border-border bg-white p-4 card-shadow"><p className="section-label">Product rules being tested</p><div className="mt-3 space-y-3"><Rule icon={<Search size={15}/>} title="One Passenger search" detail="From + To decides the right travel product automatically."/><Rule icon={<Route size={15}/>} title="Density before flexibility" detail="Shared Ride stays on published fixed corridors."/><Rule icon={<Car size={15}/>} title="Outstation by origin area" detail="Flexible destination, round trip only for this launch model."/><Rule icon={<ShieldCheck size={15}/>} title="Admin verifies, Driver joins" detail="Self-onboarding scales supply without weakening trust."/><Rule icon={<Store size={15}/>} title="Useful local surface first" detail="Community information and feedback precede paid promotion."/></div></div>
      </aside>
    </div>
  </main>;
}

function Rule({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="flex items-start gap-2.5"><span className="mt-0.5 text-primary">{icon}</span><div><p className="text-xs font-extrabold">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p></div></div>;
}
