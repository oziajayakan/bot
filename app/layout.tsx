import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SafeBot — Auto Safelink Opener',
  description:
    'Bot otomatis untuk membuka & bypass link safelink setiap hari. Kelola dan jadwalkan link safelink Anda dengan mudah.',
  keywords: ['safelink', 'bypass', 'auto opener', 'bot', 'vercel'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
