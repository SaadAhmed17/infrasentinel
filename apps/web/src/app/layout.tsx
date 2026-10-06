import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Silkscreen, Unbounded } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";

// Body and UI text
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
// Labels, IDs, timestamps, metric values
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Display: page titles and big numbers
const unbounded = Unbounded({ subsets: ["latin"], variable: "--font-unbounded" });
// Pixel accent, used sparingly
const silkscreen = Silkscreen({ subsets: ["latin"], weight: "400", variable: "--font-silkscreen" });

export const metadata: Metadata = {
  title: "InfraSentinel",
  description: "AI-Augmented Infrastructure Monitoring Platform",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8edf0" },
    { media: "(prefers-color-scheme: dark)", color: "#070c13" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${unbounded.variable} ${silkscreen.variable}`}
    >
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
