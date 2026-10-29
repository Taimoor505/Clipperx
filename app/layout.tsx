import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'ClipForge AI — Short-Form Video Clipper Engine',
  description:
    'Multimodal AI video analysis and 9:16 vertical Shorts rendering pipeline powered by Gemini and FFmpeg, complete with interactive studio and runnable Streamlit app.py script.',
  openGraph: {
    title: 'ClipForge AI — Short-Form Video Clipper Engine',
    description:
      'Multimodal AI video analysis and 9:16 vertical Shorts rendering pipeline powered by Gemini and FFmpeg, complete with interactive studio and runnable Streamlit app.py script.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClipForge AI — Short-Form Video Clipper Engine',
    description:
      'Multimodal AI video analysis and 9:16 vertical Shorts rendering pipeline powered by Gemini and FFmpeg, complete with interactive studio and runnable Streamlit app.py script.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#0B0F17] text-slate-100 font-sans antialiased selection:bg-amber-500/20 selection:text-amber-300"
      >
        {children}
      </body>
    </html>
  );
}
