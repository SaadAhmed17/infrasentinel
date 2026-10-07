import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between lg:px-10">
        <div>
          <Logo markClassName="w-5" wordmarkClassName="text-[15px]" />
          <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Final Year Project, Air University Islamabad. Supervised by Dr. Quratulain Zahid.
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">© 2026 InfraSentinel team</p>
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
