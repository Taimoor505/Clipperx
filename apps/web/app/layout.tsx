import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClipperX AI — Short-Form Video Clipper Engine',
  description:
    'Turn long-form videos into viral 9:16 vertical Shorts in 1 click using Gemini Multimodal AI and FFmpeg.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className="bg-[#0B0F17] text-white antialiased"
      >
        {children}
      </body>
    </html>
  );
}
