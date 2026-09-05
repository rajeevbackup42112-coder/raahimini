import { SignInButton } from "./SignInButton";

function safeNext(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Raahi</p>
        <h1 className="mt-2 text-3xl font-semibold">Welcome back</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Use the same Google account for Passenger and Driver capabilities. Signing in does not change your role or remove Passenger access.</p>
        <div className="mt-7">
          <SignInButton nextPath={nextPath} />
        </div>
      </div>
    </main>
  );
}
