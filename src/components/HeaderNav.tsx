'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface HeaderNavItem {
  href: string;
  label: string;
  /** Pending-review count badge (Review queue only). Omitted/0 hides the badge. */
  count?: number;
}

/**
 * design/README.md: "The active state comes from the current route, not a click handler."
 * A pattern's own detail page (/patterns/[id]) should still highlight "Patterns" as active,
 * so this matches on prefix, not just exact equality — consistent with how middleware's own
 * route-prefix matching already treats /admin/* as one section.
 */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav({ items }: { items: HeaderNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="hdr-nav" aria-label="Primary">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="hdr-link"
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
        >
          {item.label}
          {Boolean(item.count) && (
            <span className="hdr-count" aria-label={`${item.count} pending`}>
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
