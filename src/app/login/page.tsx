'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CarFront, Loader2, LogIn, MapPinned, ShieldCheck } from 'lucide-react';
import BrandLockup from '@/components/ui/BrandLockup';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile) return;
    const destination = profile.role === 'admin' ? '/admin-panel' : profile.role === 'driver' ? '/driver-route-selection' : '/';
    const phoneVerified = Boolean(user.phone && user.phone_confirmed_at);
    if (!phoneVerified) { router.replace(`/profile?next=${encodeURIComponent(destination)}`); return; }
    router.replace(destination);
  }, [loading, profile, router, user]);

  const handleGoogle = async () => { setBusy(true); try { await signInWithGoogle('/login'); } finally { setBusy(false); } };
  const resolving = loading || Boolean(user && !profile);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-screen-xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Go back"><ArrowLeft size={19} /></button>
          <BrandLockup size={34}/><span className="ml-auto hidden text-xs font-semibold text-muted-foreground sm:block">Secure account access</span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-screen-xl gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch lg:px-8 lg:py-14">
        <section className="hero-surface flex min-h-[360px] flex-col justify-between p-6 sm:p-8 lg:min-h-[520px] lg:p-10">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-primary shadow-sm"><ShieldCheck size={14} />One secure Raahi account</div><p className="mt-8 text-sm font-semibold text-white/70">Welcome back</p><h1 className="mt-2 max-w-xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">Your Raahi starts here.</h1><p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">Sign in once. Raahi recognises your role and takes you straight to the experience built for you.</p></div>
          <div className="mt-8 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-3 lg:grid-cols-1 xl:grid-cols-3"><TrustPoint icon={<MapPinned size={17} />} title="Passenger" text="Shared rides and Outstation quotes." /><TrustPoint icon={<CarFront size={17} />} title="Driver" text="Routes, demand alerts and Outstation leads." /><TrustPoint icon={<ShieldCheck size={17} />} title="Admin" text="Operate users, trust, routes and support." /></div>
        </section>

        <section className="flex items-center"><div className="w-full rounded-3xl border border-border bg-card p-6 card-shadow-md sm:p-8 lg:p-10">
          {resolving || user ? <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center"><Loader2 className="animate-spin text-primary" /><p className="text-sm font-semibold text-muted-foreground">Opening your Raahi…</p></div> : <div>
            <p className="section-label">Sign in</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">Continue to your account</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use the Google account linked to your Raahi profile. Your role is selected automatically after sign-in.</p>
            <button disabled={busy} onClick={handleGoogle} className="btn-primary mt-7 w-full py-3.5">{busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}{busy ? 'Opening Google…' : 'Continue with Google'}</button>
            <div className="mt-6 rounded-2xl bg-secondary/60 px-4 py-3"><div className="flex items-start gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-sm font-bold text-foreground">Phone verification protects ride actions</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">After sign-in, Raahi will guide you through verification if your account still needs it.</p></div></div></div>
            <button onClick={() => router.push('/')} className="mt-5 w-full text-center text-sm font-semibold text-primary hover:underline">Browse routes without signing in</button>
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm font-semibold text-primary"><Link href="/offers" className="hover:underline">Around Raahi</Link><span className="text-muted-foreground">·</span><Link href="/contact" className="hover:underline">Contact Raahi · Suggest an idea · Promote your business</Link></div>
            <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">Raahi uses Google for account sign-in. Trip and role access remain governed by your verified Raahi profile.</p>
          </div>}
        </div></section>
      </main>
    </div>
  );
}

function TrustPoint({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm sm:p-4"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">{icon}</div><p className="mt-3 text-xs font-bold text-white sm:text-sm">{title}</p><p className="mt-1 hidden text-xs leading-relaxed text-white/65 sm:block">{text}</p></div>;
}
