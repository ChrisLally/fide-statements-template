import { RootProvider } from 'fumadocs-ui/provider/next';
import { TooltipProvider } from '@/components/ui/tooltip';
import './global.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

function resolveMetadataBase(): URL {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return new URL(siteUrl);

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return new URL(`https://${vercelUrl}`);

  return new URL('http://localhost:3000');
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <TooltipProvider delayDuration={100}>
          <RootProvider
            search={{
              options: {
                api: '/docs/api/search',
              },
            }}
          >
            {children}
          </RootProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
