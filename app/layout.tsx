import { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Normalize metadata base URL to avoid invalid URL errors when NEXT_PUBLIC_APP_URL
// is provided without a scheme (e.g. "didisakhi.diu.one"). Ensure we always
// pass a fully-qualified URL to the Metadata API.
const _rawBase = process.env.NEXT_PUBLIC_APP_URL;
let _metadataBase = 'https://didisakhi.diu.one';
if (_rawBase) {
  // If a scheme is missing, assume https
  _metadataBase = _rawBase.startsWith('http') ? _rawBase : `https://${_rawBase}`;
}

export const metadata: Metadata = {
  title: "Didi Sakhi",
  description: "imessage-inspired ai-powered website that allows you to chat with documents",
  manifest: "/manifest.json",
  publisher: "diu.one",
  metadataBase: new URL(_metadataBase),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Didi Sakhi",
    description: "imessage-inspired ai-powered website that allows you to chat with documents",
    siteName: "Didi Sakhi",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Didi Sakhi - AI-powered chat for village development"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Didi Sakhi",
    description: "imessage-inspired ai-powered website that allows you to chat with documents",
    images: ["/og.png"],
    creator: "@diu_one",
  },
  other: {
    "slack-app-id": "",
    "og:image": "/og.png",
    "og:image:width": "1200",
    "og:image:height": "630",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Didi Sakhi",
    startupImage: [
      {
        url: "/icon.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
      }
    ]
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon.png',
    apple: '/icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/icon.png',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content"
        />
      </head>
      <body className="h-dvh">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
