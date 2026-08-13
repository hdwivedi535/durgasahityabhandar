import { PublicFooter, PublicHeader } from '@/components/public/public-header';

export default function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-4 text-muted">{description}</p>
        <p className="mt-6 rounded-lg border border-dashed border-border bg-white p-4 text-sm text-muted">
          This page shell will be built in Phase 3 (CMS + Catalogue).
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
