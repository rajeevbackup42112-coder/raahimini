import Link from 'next/link';
import BrandLockup from '@/components/ui/BrandLockup';

export default function LegalDocumentPage({ title, version, intro, children }: {
  title: string;
  version: string;
  intro: string;
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card"><div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6"><Link href="/"><BrandLockup size={34}/></Link><Link href="/contact" className="text-xs font-bold text-primary hover:underline">Contact Raahi</Link></div></header>
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-3xl border border-border bg-card p-5 card-shadow sm:p-8">
        <p className="section-label">Legal · {version}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
        <div className="mt-7 space-y-7 text-sm leading-7 text-foreground [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:tracking-tight [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:text-muted-foreground">
          {children}
        </div>
        <div className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground">Questions or legal notices can be sent through <Link href="/contact" className="font-bold text-primary underline">Contact Raahi</Link>. These launch documents should be reviewed by qualified Indian counsel as the service expands.</div>
      </div>
    </main>
  </div>;
}
