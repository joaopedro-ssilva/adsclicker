import type { Metadata, Viewport } from 'next';
import { Nunito_Sans, Silkscreen } from 'next/font/google';
import './globals.css';

// Silkscreen has no lowercase: it is for titles, numbers and short labels. Nunito Sans carries all running text.
const display = Silkscreen({
  weight: ['400', '700'],
  subsets: ['latin', 'latin-ext'],
  variable: '--font-pixel',
});

const body = Nunito_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'ADSClicker',
  description: 'Clicker e idle em pixel art sobre o corpo docente do curso de ADS. Remaster do Edécio Clicker.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0e0f14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
