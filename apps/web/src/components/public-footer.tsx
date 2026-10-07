import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

const LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Logo markClassName="w-5" wordmarkClassName="text-[15px]" />
          <p className="mt-3 font-mono text-[12px] text-muted-foreground">
            AI-augmented infrastructure monitoring · Final Year Project
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Footer">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/SaadAhmed17/infrasentinel"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
