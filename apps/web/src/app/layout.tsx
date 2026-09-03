import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";

export const metadata: Metadata = {
  title: "InfraSentinel",
  description: "AI-Augmented Infrastructure Monitoring Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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