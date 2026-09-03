'use client';

import { useMemo, useState } from 'react';
import {
  BellRing,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  FileCheck2,
  FileWarning,
  Gauge,
  LockKeyhole,
  Megaphone,
  Navigation,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import BrandLockup from '@/components/ui/BrandLockup';

type PersonaKey = 'passenger' | 'rajeev4' | 'naresh' | 'ajit';
type ScenarioKey = 'driver-verification' | 'shared-fifo' | 'seat-race' | 'outstation' | 'trip-lifecycle' | 'local-offers' | 'regulatory-gate';

type Persona = {
  key: PersonaKey;
  label: string;
  shortLabel: string;
  role: 'Passenger' | 'Driver' | 'Admin';
  detail: string;
};

type Scenario = {
  key: ScenarioKey;
  title: string;
  subtitle: string;
  accent: string;
  steps: Array<{ title: string; detail: string; persona: PersonaKey }>;
};

const PERSONAS: Persona[] = [
  { key: 'passenger', label: 'Rajeev1', shortLabel: 'Passenger', role: 'Passenger', detail: 'Passenger · pilot account' },
  { key: 'rajeev4', label: 'Rajeev4', shortLabel: 'Rajeev4', role: 'Driver', detail: 'Driver · Tata Tiago · 4 seats' },
  { key: 'naresh', label: 'Naresh', shortLabel: 'Naresh', role: 'Driver', detail: 'Driver · Maruti Ertiga · 6 seats' },
  { key: 'ajit', label: 'Ajit', shortLabel: 'Admin', role: 'Admin', detail: 'Admin · verification and operations' },
];

const SCENARIOS: Scenario[] = [
  {
    key: 'driver-verification',
    title: 'Driver verification',
    subtitle: 'Verified documents unlock marketplace participation',
    accent: 'Trust',
    steps: [
      { title: 'Documents missing', detail: 'Driver cannot join Shared Ride FIFO or quote for Outstation.', persona: 'rajeev4' },
      { title: 'Synthetic upload submitted', detail: 'DL, RC, car photos and operating documents are pending Admin review.', persona: 'rajeev4' },
      { title: 'Admin rejects one item', detail: 'Insurance is rejected with a review note; launch compliance remains false.', persona: 'ajit' },
      { title: 'Re-upload and approve', detail: 'Ajit approves the complete synthetic verification set.', persona: 'ajit' },
      { title: 'Driver unlocked', detail: 'Launch compliance is true and operational actions become available.', persona: 'rajeev4' },
    ],
  },
  {
    key: 'shared-fifo',
    title: 'Shared Ride FIFO',
    subtitle: 'Fair Driver rotation builds dependable corridor supply',
    accent: 'Densify',
    steps: [
      { title: 'Route selected', detail: 'Rajeev4 chooses Dhanbad → Gomoh without affecting Outstation preferences.', persona: 'rajeev4' },
      { title: 'Rajeev4 goes active', detail: 'Rajeev4 becomes ACTIVE_COLLECTING because the route has no active Driver.', persona: 'rajeev4' },
      { title: 'Naresh joins behind', detail: 'Naresh enters the same route as WAITING at position 2.', persona: 'naresh' },
      { title: 'Passenger sees the active car', detail: 'Rajeev1 sees only Rajeev4 as the collecting Driver.', persona: 'passenger' },
      { title: 'FIFO promotes next Driver', detail: 'Rajeev4 completes; Naresh is promoted without queue jumping.', persona: 'naresh' },
    ],
  },
  {
    key: 'seat-race',
    title: 'Exact-seat race',
    subtitle: 'Concurrent bookings never exceed real seat capacity',
    accent: 'Reliability',
    steps: [
      { title: 'Four seats available', detail: 'Rajeev4 is collecting with four available Passenger seats.', persona: 'passenger' },
      { title: 'Three seats held', detail: 'Passenger A requests 3 seats; only 1 seat remains available.', persona: 'passenger' },
      { title: 'Oversized second request blocked', detail: 'Passenger B requests 2 seats but the ledger has only 1 remaining.', persona: 'passenger' },
      { title: 'Last seat succeeds', detail: 'Passenger B requests exactly 1 seat and the car becomes full.', persona: 'passenger' },
      { title: 'Confirmed totals reconcile', detail: 'Trip counters and seat ledger agree at 4/4 seats.', persona: 'rajeev4' },
    ],
  },
  {
    key: 'outstation',
    title: 'Bokaro Outstation',
    subtitle: 'Area routing, Driver quotes and Passenger choice',
    accent: 'Acquire',
    steps: [
      { title: 'Passenger requests Bokaro → Ranchi', detail: 'The request is routed by Bokaro Outstation Area, not Shared Ride route preference.', persona: 'passenger' },
      { title: 'Subscribed Drivers receive the lead', detail: 'Rajeev4 and Naresh see the lead because both are subscribed to Bokaro.', persona: 'rajeev4' },
      { title: 'Naresh ignores', detail: 'The request disappears for Naresh while remaining open for other eligible Drivers.', persona: 'naresh' },
      { title: 'Rajeev4 quotes ₹3,800', detail: 'The Passenger sees the Tiago, verification trust state and quote inclusions.', persona: 'rajeev4' },
      { title: 'Passenger accepts', detail: 'Rajeev4 wins the booking; contact information becomes available at the intended stage.', persona: 'passenger' },
    ],
  },
  {
    key: 'trip-lifecycle',
    title: 'Trip lifecycle',
    subtitle: 'Accepted booking → GPS → trip → completion',
    accent: 'Operations',
    steps: [
      { title: 'Booking ready', detail: 'The confirmed Passenger and Driver see the accepted booking state.', persona: 'rajeev4' },
      { title: 'GPS becomes current', detail: 'A simulated fresh location update appears with accuracy and timestamp.', persona: 'rajeev4' },
      { title: 'Collecting Passenger', detail: 'Driver remains in the collecting stage until lifecycle conditions are met.', persona: 'passenger' },
      { title: 'Trip in progress', detail: 'The route timeline advances without manual database state editing.', persona: 'passenger' },
      { title: 'Trip completed', detail: 'Completion closes the trip once and prepares FIFO promotion.', persona: 'rajeev4' },
    ],
  },
  {
    key: 'local-offers',
    title: 'Local Offers',
    subtitle: 'Local commerce supports the network without ride commission',
    accent: 'Sustain',
    steps: [
      { title: 'No advertiser yet', detail: 'Passenger sees a clean empty state with no fake promotion.', persona: 'passenger' },
      { title: 'Ajit creates a draft', detail: 'The promotion is Admin-only and not visible to Passengers yet.', persona: 'ajit' },
      { title: 'Ajit activates the offer', detail: 'The offer becomes eligible for the public Local Offers surface.', persona: 'ajit' },
      { title: 'Passenger sees Sponsored', detail: 'The placement is clearly marked Sponsored and not personalized.', persona: 'passenger' },
    ],
  },
  {
    key: 'regulatory-gate',
    title: 'Regulatory launch gate',
    subtitle: 'Launch controls stay fail-closed outside the pilot',
    accent: 'Governance',
    steps: [
      { title: 'Public transactions OFF', detail: 'Browsing and Driver onboarding remain available while paid public operations stay locked.', persona: 'passenger' },
      { title: 'Non-pilot transaction blocked', detail: 'A public user cannot create a protected paid operation.', persona: 'passenger' },
      { title: 'Pilot account exercises the flow', detail: 'Allow-listed acceptance accounts can exercise controlled scenarios.', persona: 'rajeev4' },
      { title: 'Gate remains OFF afterward', detail: 'The test does not silently open transactions to the public.', persona: 'ajit' },
    ],
  },
];

const SCENARIO_ORDER: ScenarioKey[] = ['outstation', 'shared-fifo', 'driver-verification', 'local-offers', 'seat-race', 'trip-lifecycle', 'regulatory-gate'];
const ORDERED_SCENARIOS = SCENARIO_ORDER.map(key => SCENARIOS.find(item => item.key === key)!).filter(Boolean);

function statusClasses(status: 'good' | 'warn' | 'bad' | 'quiet') {
  if (status === 'good') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'warn') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'bad') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-stone-50 text-stone-600 border-stone-200';
}

function StatusPill({ children, status = 'quiet' }: { children: React.ReactNode; status?: 'good' | 'warn' | 'bad' | 'quiet' }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(status)}`}>{children}</span>;
}

function MiniHeader({ persona }: { persona: Persona }) {
  return <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
    <BrandLockup size={28} />
    <div className="text-right">
      <p className="text-xs font-extrabold text-foreground">{persona.label}</p>
      <p className="text-[10px] text-muted-foreground">{persona.role} demo</p>
    </div>
  </div>;
}

function DocumentRow({ label, status, note }: { label: string; status: 'MISSING' | 'PENDING' | 'VERIFIED' | 'REJECTED'; note?: string }) {
  const tone = status === 'VERIFIED' ? 'good' : status === 'REJECTED' ? 'bad' : status === 'PENDING' ? 'warn' : 'quiet';
  const Icon = status === 'VERIFIED' ? FileCheck2 : status === 'REJECTED' ? XCircle : FileWarning;
  return <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white p-3">
    <div className="flex min-w-0 items-start gap-2.5"><Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground"/><div><p className="text-xs font-extrabold">{label}</p>{note&&<p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{note}</p>}</div></div>
    <StatusPill status={tone}>{status}</StatusPill>
  </div>;
}

function DriverVerificationSurface({ step, persona }: { step: number; persona: Persona }) {
  if (persona.role === 'Passenger') return <RestrictedSurface title="Driver verification is not a Passenger surface" />;
  if (persona.key === 'naresh') return <RestrictedSurface title="This verification scenario follows Rajeev4" />;
  if (persona.role === 'Admin') {
    const rejected = step === 2;
    const approved = step >= 3;
    return <div className="space-y-3 p-4">
      <div><p className="section-label">Admin · Verification</p><h2 className="mt-1 text-lg font-extrabold">Rajeev4 · TATA TIAGO</h2><p className="mt-1 text-xs text-muted-foreground">Synthetic acceptance fixture · JH10RS1234</p></div>
      <DocumentRow label="Driving licence" status={approved ? 'VERIFIED' : step >= 1 ? 'PENDING' : 'MISSING'} />
      <DocumentRow label="Vehicle RC" status={approved ? 'VERIFIED' : step >= 1 ? 'PENDING' : 'MISSING'} />
      <DocumentRow label="Car photos" status={approved ? 'VERIFIED' : step >= 1 ? 'PENDING' : 'MISSING'} />
      <DocumentRow label="Insurance" status={approved ? 'VERIFIED' : rejected ? 'REJECTED' : step >= 1 ? 'PENDING' : 'MISSING'} note={rejected ? 'Admin note: document does not match the Driver record.' : undefined} />
      <div className="grid grid-cols-2 gap-2 pt-1"><button className="btn-outline !px-3 !py-2 text-xs">Reject</button><button className="btn-primary !px-3 !py-2 text-xs">Approve</button></div>
    </div>;
  }
  const missing = step === 0;
  const pending = step === 1;
  const rejected = step === 2;
  const verified = step >= 3;
  return <div className="space-y-3 p-4">
    <div className="rounded-2xl bg-secondary p-4"><div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 text-primary"/><div><p className="text-sm font-extrabold">Driver verification</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Verification and operating compliance protect Shared Ride and Outstation access.</p></div></div></div>
    <DocumentRow label="Driving licence" status={verified ? 'VERIFIED' : pending || rejected ? 'PENDING' : 'MISSING'} />
    <DocumentRow label="Vehicle RC" status={verified ? 'VERIFIED' : pending || rejected ? 'PENDING' : 'MISSING'} />
    <DocumentRow label="Car photos" status={verified ? 'VERIFIED' : pending || rejected ? 'PENDING' : 'MISSING'} />
    <DocumentRow label="Insurance" status={verified ? 'VERIFIED' : rejected ? 'REJECTED' : pending ? 'PENDING' : 'MISSING'} note={rejected ? 'Please replace this document before operations can unlock.' : undefined} />
    <div className={`rounded-xl border p-3 ${verified ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><p className="text-xs font-extrabold">{verified ? 'Launch compliant' : missing ? 'Complete verification' : rejected ? 'Action required' : 'Review pending'}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{verified ? 'Shared Ride FIFO and Outstation quoting are available in this simulated state.' : 'Paid Driver operations remain locked.'}</p></div>
  </div>;
}

function SharedFifoSurface({ step, persona }: { step: number; persona: Persona }) {
  const r4Status = step === 0 ? 'Not queued' : step >= 4 ? 'Done' : 'ACTIVE_COLLECTING';
  const nareshStatus = step < 2 ? 'Not queued' : step >= 4 ? 'ACTIVE_COLLECTING' : 'WAITING · #2';
  if (persona.role === 'Passenger') {
    if (step === 0) return <div className="space-y-3 p-4"><div><p className="section-label">From Dhanbad</p><h2 className="mt-1 text-lg font-extrabold">Dhanbad → Gomoh</h2></div><div className="rounded-2xl border border-border bg-white p-5 text-center"><Car size={24} className="mx-auto text-muted-foreground"/><p className="mt-2 text-sm font-extrabold">No car right now</p><p className="mt-1 text-xs text-muted-foreground">Rajeev4 has selected this route but has not gone available yet.</p></div></div>;
    return <div className="space-y-3 p-4"><div><p className="section-label">From Dhanbad</p><h2 className="mt-1 text-lg font-extrabold">Dhanbad → Gomoh</h2></div><div className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-extrabold">{step >= 4 ? 'Naresh · Ertiga' : 'Rajeev4 · Tiago'}</p><p className="mt-1 text-xs text-muted-foreground">Verified Driver · live route status</p></div><StatusPill status="good">Collecting</StatusPill></div><div className="mt-4 flex items-center justify-between rounded-xl bg-muted p-3"><span className="text-xs font-bold">Fare per seat</span><span className="text-sm font-extrabold">₹150</span></div></div></div>;
  }
  return <div className="space-y-3 p-4"><div><p className="section-label">Shared Ride FIFO</p><h2 className="mt-1 text-lg font-extrabold">DG-01 · Dhanbad → Gomoh</h2><p className="mt-1 text-xs text-muted-foreground">Route preference does not subscribe Outstation areas.</p></div><QueueRow name="Rajeev4" car="TATA TIAGO · 4 seats" status={r4Status} active={r4Status === 'ACTIVE_COLLECTING'} /><QueueRow name="Naresh" car="Maruti Ertiga · 6 seats" status={nareshStatus} active={nareshStatus === 'ACTIVE_COLLECTING'} /><div className="rounded-xl border border-border bg-stone-50 p-3 text-[10px] leading-relaxed text-muted-foreground">FIFO rule: one active collecting Driver per route. Waiting Drivers cannot jump the queue.</div></div>;
}

function QueueRow({ name, car, status, active }: { name: string; car: string; status: string; active: boolean }) {
  return <div className={`rounded-2xl border p-4 ${active ? 'border-primary/30 bg-secondary' : 'border-border bg-white'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold">{name}</p><p className="mt-1 text-xs text-muted-foreground">{car}</p></div><StatusPill status={active ? 'good' : status.startsWith('WAITING') ? 'warn' : 'quiet'}>{status}</StatusPill></div></div>;
}

function SeatRaceSurface({ step, persona }: { step: number; persona: Persona }) {
  const held = step === 0 ? 0 : step < 3 ? 3 : 4;
  const available = 4 - held;
  const blocked = step === 2;
  return <div className="space-y-4 p-4"><div><p className="section-label">Exact-seat ledger</p><h2 className="mt-1 text-lg font-extrabold">Rajeev4 · DG-01</h2><p className="mt-1 text-xs text-muted-foreground">4 Passenger seats · simulated concurrency test</p></div><div className="grid grid-cols-4 gap-2">{[1,2,3,4].map(n=><div key={n} className={`rounded-xl border p-3 text-center ${n <= held ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><Car size={15} className="mx-auto"/><p className="mt-1 text-[10px] font-bold">Seat {n}</p><p className="mt-1 text-[9px] text-muted-foreground">{n <= held ? 'HELD' : 'AVAILABLE'}</p></div>)}</div><div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-muted p-3"><p className="text-[10px] text-muted-foreground">Held/confirmed</p><p className="mt-1 text-xl font-extrabold">{held}/4</p></div><div className="rounded-xl bg-muted p-3"><p className="text-[10px] text-muted-foreground">Available</p><p className="mt-1 text-xl font-extrabold">{available}</p></div></div>{blocked&&<div className="rounded-xl border border-red-200 bg-red-50 p-3"><p className="text-xs font-extrabold text-red-700">2-seat request blocked</p><p className="mt-1 text-[10px] leading-relaxed text-red-700">Only one seat remains. No partial or over-capacity booking is created.</p></div>}{step >= 3&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-extrabold text-emerald-800">Ledger reconciled</p><p className="mt-1 text-[10px] text-emerald-700">The final one-seat request succeeds and counters agree at 4/4.</p></div>}<p className="text-[10px] text-muted-foreground">Viewing as {persona.label} · this simulation performs no database writes.</p></div>;
}

function OutstationSurface({ step, persona }: { step: number; persona: Persona }) {
  const accepted = step >= 4;
  const quoted = step >= 3;
  if (persona.role === 'Admin') return <RestrictedSurface title="Admin can observe Outstation operations but does not quote for Drivers" />;
  if (persona.role === 'Passenger') return <div className="space-y-3 p-4"><div><p className="section-label">Raahi Outstation</p><h2 className="mt-1 text-lg font-extrabold">Bokaro → Ranchi</h2><p className="mt-1 text-xs text-muted-foreground">Round trip · 3 passengers · tomorrow 7:00 AM</p></div>{!quoted&&<div className="rounded-2xl border border-border bg-white p-5 text-center"><Clock3 size={22} className="mx-auto text-muted-foreground"/><p className="mt-2 text-sm font-extrabold">Waiting for Driver prices</p><p className="mt-1 text-xs text-muted-foreground">Only eligible Drivers subscribed to Bokaro receive this lead.</p></div>}{quoted&&<div className={`rounded-2xl border p-4 ${accepted ? 'border-emerald-200 bg-emerald-50' : 'border-primary/20 bg-white'}`}><div className="flex items-start justify-between"><div><p className="text-sm font-extrabold">Rajeev4 · TATA TIAGO</p><p className="mt-1 text-xs text-muted-foreground">JH10RS1234 · 4 seats · verified</p></div><StatusPill status="good">{accepted ? 'Accepted' : 'Quote'}</StatusPill></div><div className="mt-4 flex items-end justify-between"><div><p className="text-[10px] text-muted-foreground">Total price</p><p className="text-2xl font-extrabold">₹3,800</p></div>{!accepted&&<button className="btn-primary !px-3 !py-2 text-xs">Choose quote</button>}</div><p className="mt-3 text-[10px] text-muted-foreground">Tolls included · Parking extra</p>{accepted&&<div className="mt-3 rounded-xl bg-white/70 p-3"><p className="text-xs font-extrabold">Contact unlocked after acceptance</p><p className="mt-1 text-[10px] text-muted-foreground">Passenger and Driver contact details are now available to the matched parties.</p></div>}</div>}</div>;
  const ignored = persona.key === 'naresh' && step >= 2;
  if (persona.key === 'rajeev4' && accepted) return <div className="space-y-3 p-4"><div><p className="section-label">Accepted Outstation work</p><h2 className="mt-1 text-lg font-extrabold">Bokaro → Ranchi</h2></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start justify-between"><div><p className="text-sm font-extrabold">₹3,800 · Rajeev1</p><p className="mt-1 text-xs text-emerald-800">TATA TIAGO · JH10RS1234</p></div><StatusPill status="good">Accepted</StatusPill></div><div className="mt-3 rounded-xl bg-white/70 p-3"><p className="text-xs font-extrabold">Passenger contact unlocked</p><p className="mt-1 text-[10px] text-muted-foreground">Contact details are available only after the Passenger accepts this Driver's quote.</p></div></div></div>;
  return <div className="space-y-3 p-4"><div><p className="section-label">Outstation lead</p><h2 className="mt-1 text-lg font-extrabold">Bokaro → Ranchi</h2><p className="mt-1 text-xs text-muted-foreground">3 passengers · Bokaro service area</p></div>{ignored?<div className="rounded-2xl border border-border bg-stone-50 p-5 text-center"><BellRing size={22} className="mx-auto text-muted-foreground"/><p className="mt-2 text-sm font-extrabold">Lead ignored</p><p className="mt-1 text-xs text-muted-foreground">It is hidden for Naresh but remains open for other eligible Drivers.</p></div>:<div className="rounded-2xl border border-border bg-white p-4"><div className="flex items-start justify-between"><div><p className="text-sm font-extrabold">Passenger needs a car</p><p className="mt-1 text-xs text-muted-foreground">Bokaro pickup · Ranchi destination</p></div><StatusPill status="good">Eligible</StatusPill></div>{persona.key === 'rajeev4'&&step >= 3?<div className="mt-4 rounded-xl bg-secondary p-3"><p className="text-xs font-extrabold">Your quote · ₹3,800</p><p className="mt-1 text-[10px] text-muted-foreground">Tolls included · Parking extra</p></div>:<div className="mt-4 grid grid-cols-2 gap-2"><button className="btn-outline !px-3 !py-2 text-xs">Ignore</button><button className="btn-primary !px-3 !py-2 text-xs">Send price</button></div>}</div>}</div>;
}

function TripLifecycleSurface({ step, persona }: { step: number; persona: Persona }) {
  const stages = ['Accepted', 'GPS current', 'Collecting', 'In progress', 'Completed'];
  const current = Math.min(step, stages.length - 1);
  return <div className="space-y-4 p-4"><div><p className="section-label">Shared trip</p><h2 className="mt-1 text-lg font-extrabold">Dhanbad → Gomoh</h2><p className="mt-1 text-xs text-muted-foreground">Rajeev4 · Rajeev1 · DG-01</p></div><div className="space-y-0">{stages.map((label,index)=><div key={label} className="flex gap-3"><div className="flex flex-col items-center"><span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${index <= current ? 'bg-primary text-white' : 'bg-stone-200 text-stone-500'}`}>{index < current ? <CheckCircle2 size={14}/> : <Circle size={9}/>}</span>{index<stages.length-1&&<span className={`h-8 w-0.5 ${index < current ? 'bg-primary' : 'bg-stone-200'}`}/>}</div><div className="pb-4"><p className={`text-xs font-extrabold ${index <= current ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>{index===1&&step>=1&&<p className="mt-1 text-[10px] text-muted-foreground">23.6693, 86.1511 · ±18 m · fresh</p>}</div></div>)}</div><div className="rounded-xl border border-border bg-stone-50 p-3"><div className="flex items-center gap-2"><Navigation size={15} className="text-primary"/><p className="text-xs font-extrabold">Simulated GPS only</p></div><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">No device location is sent to the production trip_live_locations table.</p></div><p className="text-[10px] text-muted-foreground">Current persona: {persona.label}</p></div>;
}

function LocalOffersSurface({ step, persona }: { step: number; persona: Persona }) {
  if (persona.role === 'Admin') return <div className="space-y-3 p-4"><div><p className="section-label">Operations · Promotions</p><h2 className="mt-1 text-lg font-extrabold">Local Offers</h2></div>{step===0?<div className="rounded-2xl border border-border bg-white p-5 text-center text-xs text-muted-foreground">No promotion records in the scenario.</div>:<div className="rounded-2xl border border-border bg-white p-4"><div className="flex items-start justify-between"><div><p className="text-sm font-extrabold">City Sweets · Bokaro</p><p className="mt-1 text-xs text-muted-foreground">10% off evening snack boxes</p></div><StatusPill status={step>=2?'good':'warn'}>{step>=2?'ACTIVE':'DRAFT'}</StatusPill></div><p className="mt-3 text-[10px] text-muted-foreground">Amount collected · ₹1,200 · Admin-only field</p></div>}</div>;
  return <div className="space-y-3 p-4"><div><p className="section-label">Local Offers</p><h2 className="mt-1 text-lg font-extrabold">Local businesses help support Raahi.</h2><p className="mt-1 text-xs text-muted-foreground">No Passenger platform fee or Driver commission at launch.</p></div>{step<2?<div className="rounded-2xl border border-border bg-white p-6 text-center"><Megaphone size={23} className="mx-auto text-muted-foreground"/><p className="mt-2 text-sm font-extrabold">No local offers right now</p><p className="mt-1 text-xs text-muted-foreground">Draft promotions stay invisible until Admin activates them.</p></div>:<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-amber-800">Sponsored</p><p className="mt-1 text-sm font-extrabold">City Sweets · Bokaro</p></div><Sparkles size={18} className="text-amber-700"/></div><p className="mt-2 text-xs text-amber-900">10% off evening snack boxes</p><p className="mt-3 text-[10px] text-amber-800">Sponsored, not personalized.</p></div>}</div>;
}

function RegulatorySurface({ step, persona }: { step: number; persona: Persona }) {
  const pilot = persona.key === 'rajeev4' || persona.key === 'naresh';
  return <div className="space-y-4 p-4"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><LockKeyhole size={20} className="mt-0.5 text-amber-800"/><div><p className="text-sm font-extrabold text-amber-900">Public transactions are OFF</p><p className="mt-1 text-xs leading-relaxed text-amber-800">Browsing, recruitment and verification remain available while public paid ride operations stay fail-closed.</p></div></div></div><div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-border bg-white p-3"><p className="text-[10px] text-muted-foreground">Public switch</p><p className="mt-1 text-sm font-extrabold">OFF</p></div><div className="rounded-xl border border-border bg-white p-3"><p className="text-[10px] text-muted-foreground">Current account</p><p className="mt-1 text-sm font-extrabold">{pilot ? 'Pilot' : persona.role}</p></div></div>{step===1&&!pilot&&<div className="rounded-xl border border-red-200 bg-red-50 p-3"><p className="text-xs font-extrabold text-red-700">Protected operation blocked</p><p className="mt-1 text-[10px] text-red-700">A non-pilot public user cannot bypass the regulatory launch gate.</p></div>}{step>=2&&pilot&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-extrabold text-emerald-800">Controlled pilot scenario allowed</p><p className="mt-1 text-[10px] text-emerald-700">The simulator demonstrates the acceptance path without changing the live switch.</p></div>}{step>=3&&<div className="rounded-xl border border-primary/20 bg-secondary p-3"><p className="text-xs font-extrabold">Post-test invariant</p><p className="mt-1 text-[10px] text-muted-foreground">Public transactions remain OFF after the scenario completes.</p></div>}</div>;
}

function RestrictedSurface({ title }: { title: string }) {
  return <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><LockKeyhole size={30} className="text-muted-foreground"/><p className="mt-3 text-sm font-extrabold">{title}</p><p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">Switch persona in the Demo controls to see the relevant simulated surface.</p></div>;
}

function DemoSurface({ scenario, step, persona }: { scenario: Scenario; step: number; persona: Persona }) {
  let content: React.ReactNode;
  if (scenario.key === 'driver-verification') content = <DriverVerificationSurface step={step} persona={persona}/>;
  else if (scenario.key === 'shared-fifo') content = <SharedFifoSurface step={step} persona={persona}/>;
  else if (scenario.key === 'seat-race') content = <SeatRaceSurface step={step} persona={persona}/>;
  else if (scenario.key === 'outstation') content = <OutstationSurface step={step} persona={persona}/>;
  else if (scenario.key === 'trip-lifecycle') content = <TripLifecycleSurface step={step} persona={persona}/>;
  else if (scenario.key === 'local-offers') content = <LocalOffersSurface step={step} persona={persona}/>;
  else content = <RegulatorySurface step={step} persona={persona}/>;
  return <div className="overflow-hidden rounded-[28px] border border-border bg-[#FAF9F6] shadow-xl"><MiniHeader persona={persona}/><div className="min-h-[520px]">{content}</div></div>;
}

export default function DemoExperience() {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>('outstation');
  const [step, setStep] = useState(0);
  const [personaKey, setPersonaKey] = useState<PersonaKey>('passenger');
  const scenario = useMemo(() => SCENARIOS.find(item => item.key === scenarioKey) ?? SCENARIOS[0], [scenarioKey]);
  const persona = useMemo(() => PERSONAS.find(item => item.key === personaKey) ?? PERSONAS[0], [personaKey]);
  const activeStep = scenario.steps[Math.min(step, scenario.steps.length - 1)];

  const chooseScenario = (next: Scenario) => {
    setScenarioKey(next.key);
    setStep(0);
    setPersonaKey(next.steps[0].persona);
  };
  const move = (delta: number) => {
    const next = Math.max(0, Math.min(scenario.steps.length - 1, step + delta));
    setStep(next);
    setPersonaKey(scenario.steps[next].persona);
  };
  const reset = () => {
    setStep(0);
    setPersonaKey(scenario.steps[0].persona);
  };

  return <main className="min-h-screen bg-[#F6F4EE] text-foreground">
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[11px] font-extrabold tracking-wide text-amber-900">RAAHI DEMO · SIMULATED MARKETPLACE · NO REAL RIDES OR LIVE DATA CHANGES</div>
    <header className="border-b border-border bg-white/95 px-4 py-4 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3"><div><BrandLockup size={36}/><p className="mt-1 text-xs text-muted-foreground">Local mobility for towns and corridors underserved by formal platforms.</p></div><div className="flex flex-wrap gap-2"><StatusPill status="good">PASSENGER · DRIVER · ADMIN</StatusPill><StatusPill status="warn">SAFE DEMO · NO LIVE CHANGES</StatusPill></div></div></header>

    <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[280px_minmax(0,1fr)_330px]">
      <aside className="min-w-0 rounded-3xl border border-border bg-white p-3 card-shadow xl:sticky xl:top-5 xl:h-fit"><div className="px-2 pb-3"><p className="section-label">Scenario library</p><h1 className="mt-1 text-lg font-extrabold">Walk the marketplace</h1><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Acquire supply → densify corridors → build trust → sustain with local commerce.</p></div><div className="flex max-w-full gap-2 overflow-x-auto pb-1 xl:block xl:space-y-1">{ORDERED_SCENARIOS.map(item=><button key={item.key} onClick={()=>chooseScenario(item)} className={`min-w-[220px] rounded-2xl px-3 py-3 text-left transition xl:w-full xl:min-w-0 ${item.key===scenario.key?'bg-primary text-white':'hover:bg-muted'}`}><p className={`text-[10px] font-bold uppercase tracking-wider ${item.key===scenario.key?'text-white/70':'text-muted-foreground'}`}>{item.accent}</p><p className="mt-1 text-sm font-extrabold">{item.title}</p><p className={`mt-1 text-[10px] leading-relaxed ${item.key===scenario.key?'text-white/75':'text-muted-foreground'}`}>{item.subtitle}</p></button>)}</div></aside>

      <section className="min-w-0"><div className="mb-4 rounded-3xl border border-border bg-white p-5 card-shadow"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-label">Current scenario</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight">{scenario.title}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{activeStep.detail}</p></div><StatusPill status="good">Step {step+1} / {scenario.steps.length}</StatusPill></div></div><div className="mx-auto max-w-[700px]"><DemoSurface scenario={scenario} step={step} persona={persona}/></div></section>

      <aside className="space-y-4 xl:sticky xl:top-5 xl:h-fit"><div className="rounded-3xl border border-border bg-white p-4 card-shadow"><div className="flex items-center gap-2"><Gauge size={17} className="text-primary"/><div><p className="section-label">Demo controls</p><p className="mt-1 text-sm font-extrabold">Switch role. Advance state.</p></div></div><div className="mt-4 grid grid-cols-2 gap-2">{PERSONAS.map(item=><button key={item.key} onClick={()=>setPersonaKey(item.key)} aria-pressed={item.key===persona.key} className={`rounded-xl border p-3 text-left ${item.key===persona.key?'border-primary bg-secondary':'border-border bg-white hover:bg-muted'}`}><div className="flex items-center gap-2"><UserRound size={14}/><p className="text-xs font-extrabold">{item.shortLabel}</p></div><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{item.detail}</p></button>)}</div><div className="mt-4 rounded-2xl bg-muted p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{activeStep.title}</p><p className="mt-2 text-xs leading-relaxed">{activeStep.detail}</p></div><div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-2"><button onClick={()=>move(-1)} disabled={step===0} className="btn-outline !px-3 !py-2 text-xs"><ChevronLeft size={14}/>Back</button><button onClick={reset} className="btn-outline !px-3 !py-2" aria-label="Reset scenario"><RotateCcw size={14}/></button><button onClick={()=>move(1)} disabled={step===scenario.steps.length-1} className="btn-primary !px-3 !py-2 text-xs">Next<ChevronRight size={14}/></button></div></div>

        <div className="rounded-3xl border border-border bg-white p-4 card-shadow"><p className="section-label">Safe demo</p><div className="mt-3 space-y-3"><Invariant icon={<LockKeyhole size={15}/>} title="No live marketplace changes" detail="Scenario controls stay inside this browser."/><Invariant icon={<Users size={15}/>} title="Synthetic personas" detail="Switch roles instantly without Google login."/><Invariant icon={<Navigation size={15}/>} title="Simulated GPS" detail="Demo coordinates never enter live trip tracking."/><Invariant icon={<ShieldCheck size={15}/>} title="Launch controls untouched" detail="The demo never changes live launch controls."/></div></div>
      </aside>
    </div>
  </main>;
}

function Invariant({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex items-start gap-2.5"><span className="mt-0.5 text-primary">{icon}</span><div><p className="text-xs font-extrabold">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p></div></div>;
}
