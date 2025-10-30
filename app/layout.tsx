import { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: "Chat with Docs",
    template: "%s | Chat with Docs"
  },
  description: "Intelligent AI chatbot with document knowledge base. Upload PDFs, text files, and markdown to have conversations powered by your documents.",
  manifest: "/manifest.json",
  keywords: ["AI chat", "document chat", "knowledge base", "PDF chat", "AI assistant", "document AI"],
  authors: [{ name: "Chat with Docs" }],
  creator: "Chat with Docs",
  publisher: "Chat with Docs",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Chat with Docs",
    description: "Intelligent AI chatbot with document knowledge base",
    siteName: "Chat with Docs",
    images: [
      {
        url: "https://em-content.zobj.net/source/apple/419/speech-balloon_1f4ac.png",
        width: 160,
        height: 160,
        alt: "Chat with Docs Logo"
      }
    ]
  },
  twitter: {
    card: "summary",
    title: "Chat with Docs",
    description: "Intelligent AI chatbot with document knowledge base",
    images: ["https://em-content.zobj.net/source/apple/419/speech-balloon_1f4ac.png"]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chat with Docs",
    startupImage: [
      {
        url: "https://em-content.zobj.net/source/apple/419/speech-balloon_1f4ac.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
      }
    ]
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "https://em-content.zobj.net/source/apple/419/speech-balloon_1f4ac.png",
    apple: "https://em-content.zobj.net/source/apple/419/speech-balloon_1f4ac.png"
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
