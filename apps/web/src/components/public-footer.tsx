import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: 'oklch(0.62 0.19 265)' }}
            >
              <ShieldCheck className="size-4 text-white" strokeWidth={2.25} />
            </div>
            <span className="text-[14px] font-bold text-foreground">InfraSentinel</span>
          </div>

          <nav className="flex items-center gap-5">
            <Link href="/" className="text-[13px] text-muted-foreground hover:text-foreground">Home</Link>
            <Link href="/about" className="text-[13px] text-muted-foreground hover:text-foreground">About</Link>
            <Link href="/contact" className="text-[13px] text-muted-foreground hover:text-foreground">Contact</Link>
            <a
              href="https://github.com/SaadAhmed17/infrasentinel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-muted-foreground hover:text-foreground"
            >
              GitHub
            </a>
          </nav>
        </div>

        <p className="mt-6 text-[12px] text-muted-foreground">
          InfraSentinel &mdash; AI-Augmented Infrastructure Monitoring Platform. Final Year Project.
        </p>
      </div>
    </footer>
  );
}