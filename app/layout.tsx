import './globals.css';
import type { ReactNode } from 'react';
import { dict } from '@/lib/i18n';

export const metadata = {
  title: dict.en.appName,
  description: 'Hyper-local weather alerts for Telangana',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-4 py-3 font-semibold">{dict.en.appName}</div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-6 text-xs text-gray-500">
          Free public service. Data may be delayed. Use discretion.
        </footer>
      </body>
    </html>
  );
}


