'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { FooterCredit } from '@/components/ui/footer-credit';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        user={user}
        onLogout={async () => {
          await logout();
          router.push('/login');
        }}
      />
      <div className="flex flex-1 flex-col">
        <header className="border-b border-border bg-white px-6 py-4">
          <p className="text-sm text-muted">Signed in as {user.email}</p>
        </header>
        <main className="flex-1 p-6">{children}</main>
        <footer className="border-t border-border bg-white px-6 py-4">
          <FooterCredit />
        </footer>
      </div>
    </div>
  );
}
