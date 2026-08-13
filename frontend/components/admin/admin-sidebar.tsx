'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AuthUser, ModuleKey } from '@dsb/shared';
import { cn } from '@/lib/utils';

const NAV_ITEMS: Array<{ href: string; label: string; module?: ModuleKey }> = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/enquiries', label: 'Enquiries', module: 'enquiries' },
  { href: '/admin/customers', label: 'Customers', module: 'customers' },
  { href: '/admin/books', label: 'Books', module: 'books' },
  { href: '/admin/categories', label: 'Categories', module: 'categories' },
  { href: '/admin/lookups', label: 'Lookups', module: 'books' },
  { href: '/admin/website', label: 'Website', module: 'website' },
  { href: '/admin/settings', label: 'Settings', module: 'settings' },
];

interface AdminSidebarProps {
  user: AuthUser;
  onLogout: () => void;
}

export function AdminSidebar({ user, onLogout }: AdminSidebarProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.module ||
      user.roleSlugs.includes('super-admin') ||
      user.moduleAccess.includes(item.module),
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-white">
      <div className="border-b border-border px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">DSB Admin</p>
        <p className="mt-1 text-sm font-medium">{user.name}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-accent text-foreground' : 'text-muted hover:bg-accent hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <button
          onClick={onLogout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-accent hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
