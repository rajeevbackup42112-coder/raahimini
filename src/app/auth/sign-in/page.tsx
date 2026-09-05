import { headers } from "next/headers";
import { isTestModeAllowed, testModeServerConfigured } from "@/server/test-mode/access";
import { SignInButton } from "./SignInButton";
import { TestModeSignIn } from "./TestModeSignIn";

function safeNext(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const nextPath = safeNext(params.next);
  const testMode = isTestModeAllowed(requestHeaders.get("host"));

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Raahi</p>
        <h1 className="mt-2 text-3xl font-semibold">Welcome back</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Use one identity across Passenger and Driver capabilities. Signing in never changes your operational permissions by itself.</p>
        {testMode ? (
          <div className="mt-7">
            <TestModeSignIn configured={testModeServerConfigured()} nextPath={nextPath} />
          </div>
        ) : null}

        {testMode ? (
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" />
            Google
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
        ) : null}

        <div className={testMode ? "" : "mt-7"}>
          <SignInButton nextPath={nextPath} />
        </div>
      </div>
    </main>
  );
}
