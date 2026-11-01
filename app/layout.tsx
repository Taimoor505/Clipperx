import type { Metadata } from 'next';
import { Instrument_Sans } from 'next/font/google';
import './globals.css';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'ClipperX',
  description: 'Turn long videos into short vertical clips with captions.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body suppressHydrationWarning className="bg-canvas text-ink font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
