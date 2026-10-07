import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { Providers } from "@/components/providers";

// Body and UI text, including numbers
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
// Machine data only: hostnames, IPs, keys, commands, raw values
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Display: page titles and the home page hero
const unbounded = Unbounded({ subsets: ["latin"], variable: "--font-unbounded" });

export const metadata: Metadata = {
  // pages set their own title, e.g. "Servers | InfraSentinel"
  title: { default: "InfraSentinel", template: "%s | InfraSentinel" },
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
      className={`${geist.variable} ${geistMono.variable} ${unbounded.variable}`}
    >
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <AuthProvider>
          <Providers>{children}</Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
