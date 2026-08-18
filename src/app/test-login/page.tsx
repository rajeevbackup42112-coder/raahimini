import { notFound } from 'next/navigation';
import TestLoginForm from './TestLoginForm';

export const dynamic = 'force-dynamic';

export default function TestLoginPage() {
  if (process.env.RAAHI_TEST_AUTH_ENABLED !== 'true') {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Raahi Test Login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Staging-only login for automated acceptance testing.
        </p>
        <TestLoginForm />
      </div>
    </main>
  );
}
