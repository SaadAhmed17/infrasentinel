import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-[32px] font-bold tracking-tight text-foreground">
          About InfraSentinel
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          InfraSentinel is an AI-augmented infrastructure monitoring platform built
          as a Final Year Project. It combines three things that are usually kept
          in separate tools: server performance monitoring, security event
          detection (SIEM), and AI-based anomaly detection with a plain-language
          assistant to explain what it finds.
        </p>

        <h2 className="mt-10 text-[20px] font-bold text-foreground">What it does</h2>
        <ul className="mt-3 space-y-2 text-[15px] text-muted-foreground">
          <li>&bull; Collects live metrics from every registered server via a lightweight agent</li>
          <li>&bull; Detects attacks such as brute-force logins, unauthorized root access, and API abuse</li>
          <li>&bull; Runs a deep-learning model (LSTM-Autoencoder) to catch anomalies static rules miss</li>
          <li>&bull; Groups related alerts into incidents, and lets an AI assistant explain them in plain English</li>
        </ul>

        <h2 className="mt-10 text-[20px] font-bold text-foreground">Project team</h2>
        <ul className="mt-3 space-y-1 text-[15px] text-muted-foreground">
          <li>Farhan</li>
          <li>Saad Ahmed</li>
          <li>Hashim Ahmed Khan</li>
        </ul>
        <p className="mt-4 text-[13px] text-muted-foreground">
          Supervised by Dr. Quratulain Zahid.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}