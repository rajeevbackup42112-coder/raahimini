"use client";

import { useState } from "react";

type Persona =
  | "PASSENGER"
  | "DRIVER"
  | "PASSENGER_DRIVER"
  | "MARKET_ADMIN"
  | "PLATFORM_ADMIN";

const personaOptions: Array<{ value: Persona; label: string }> = [
  { value: "PASSENGER", label: "Passenger" },
  { value: "DRIVER", label: "Driver" },
  { value: "PASSENGER_DRIVER", label: "Passenger + Driver" },
  { value: "MARKET_ADMIN", label: "Market Admin" },
  { value: "PLATFORM_ADMIN", label: "Platform Admin" },
];

export function TestModeSignIn({ configured }: { configured: boolean }) {
  const [displayName, setDisplayName] = useState("Naresh Test");
  const [email, setEmail] = useState("naresh@raahi.test");
  const [persona, setPersona] = useState<Persona>("PASSENGER_DRIVER");
  const [homeMarketCode, setHomeMarketCode] = useState("GOMOH");
  const [adminMarketCode, setAdminMarketCode] = useState("GOMOH");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const needsHomeMarket = persona === "DRIVER" || persona === "PASSENGER_DRIVER";
  const needsAdminMarket = persona === "MARKET_ADMIN";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/test-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          persona,
          homeMarketCode: needsHomeMarket ? homeMarketCode : undefined,
          adminMarketCode: needsAdminMarket ? adminMarketCode : undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.error === "TEST_MODE_SERVER_NOT_CONFIGURED") {
          setMessage("Test Mode needs its server-only Supabase key before it can create sessions.");
        } else if (result.error === "USE_A_SYNTHETIC_TEST_EMAIL") {
          setMessage("Use a synthetic address ending in @raahi.test.");
        } else {
          setMessage("Could not start this test persona.");
        }
        return;
      }
      window.location.assign(result.redirectTo ?? "/");
    } catch {
      setMessage("Could not reach Raahi Test Mode.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Test Mode</p>
          <p className="mt-1 text-sm text-amber-950">Create a real Raahi test identity without Google.</p>
        </div>
        <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">Dev only</span>
      </div>

      <label className="mt-4 block text-sm font-medium text-zinc-800">
        Name
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-950"
          required
        />
      </label>

      <label className="mt-3 block text-sm font-medium text-zinc-800">
        Test email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-950"
          required
        />
        <span className="mt-1 block text-xs text-zinc-500">Use a synthetic address such as naresh@raahi.test.</span>
      </label>
      <label className="mt-3 block text-sm font-medium text-zinc-800">
        Persona
        <select
          value={persona}
          onChange={(event) => setPersona(event.target.value as Persona)}
          className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-950"
        >
          {personaOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      {needsHomeMarket ? (
        <label className="mt-3 block text-sm font-medium text-zinc-800">
          Home Market
          <select
            value={homeMarketCode}
            onChange={(event) => setHomeMarketCode(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-950"
          >
            <option value="GOMOH">Gomoh</option>
            <option value="DHANBAD">Dhanbad</option>
          </select>
        </label>
      ) : null}

      {needsAdminMarket ? (
        <label className="mt-3 block text-sm font-medium text-zinc-800">
          Admin Market
          <select
            value={adminMarketCode}
            onChange={(event) => setAdminMarketCode(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-950"
          >
            <option value="GOMOH">Gomoh</option>
            <option value="DHANBAD">Dhanbad</option>
          </select>
        </label>
      ) : null}
      <button
        type="submit"
        disabled={busy || !configured}
        className="mt-4 w-full rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Starting test persona…" : "Test Raahi without Google"}
      </button>

      {!configured ? (
        <p className="mt-2 text-xs text-amber-900">Server setup is not complete yet.</p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-rose-700" role="status">{message}</p> : null}
    </form>
  );
}
