import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinFixedCard } from "@/features/passenger-fixed/JoinFixedCard";
import { createClient } from "@/lib/supabase/server";
import { getFixedProductDetail } from "@/server/projections/passenger-fixed";

export default async function FixedProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = await getFixedProductDetail(productId);
  if (!product) notFound();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = Boolean(claims?.claims?.sub);
  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-xl">
      <Link href={`/go?origin=${product.origin_location_id}&destination=${product.destination_location_id}`} className="text-sm font-semibold text-zinc-600">← Ways to go</Link>
      <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">Shared one way</p>
        <h1 className="mt-2 text-3xl font-semibold">{product.origin_name} → {product.destination_name}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{product.public_summary}</p>
        <div className="mt-6 flex items-end justify-between rounded-2xl border border-zinc-200 p-4"><div><p className="text-sm text-zinc-500">Fare</p><p className="mt-1 text-2xl font-semibold">₹{product.fare_per_seat_inr} <span className="text-sm font-normal text-zinc-500">per seat</span></p></div><p className="text-sm text-zinc-500">1–{product.max_seats_per_request} seats</p></div>
        <JoinFixedCard product={product} signedIn={signedIn} />
      </section>
    </div></main>
  );
}
