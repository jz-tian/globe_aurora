import type { Metadata } from 'next';
import { Cormorant, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

const ibmMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Aurora Live',
  description: 'Real-time global aurora intensity visualization',
  openGraph: {
    title: 'Aurora Live',
    description: 'Real-time global aurora intensity visualization',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aurora Live',
    description: 'Real-time global aurora intensity visualization',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${ibmMono.variable}`}
      suppressHydrationWarning
    >
      <body style={{ fontFamily: 'var(--font-mono), monospace' }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
