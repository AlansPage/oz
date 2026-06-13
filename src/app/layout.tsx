import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Montserrat } from "next/font/google";
import { SupabaseProvider } from "@/components/SupabaseProvider";
import { MiniAppProvider } from "@/components/telegram/MiniAppProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["600"],
  display: "swap",
  variable: "--font-pill",
});

export const metadata: Metadata = {
  title: "öz — обмен KZT и KRW",
  description:
    "P2P маркетплейс для обмена тенге и вон в Корее. Сообщество казахстанцев в Корее.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "öz",
    statusBarStyle: "default",
  },
};

// No maximumScale: blocking pinch zoom is an accessibility violation, and
// the old iOS input-zoom motivation is gone now that text inputs are 16px
// on touch devices (see globals.css).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5F0E8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${inter.variable} ${jetbrainsMono.variable} ${montserrat.variable}`}>
      <body>
        <SupabaseProvider>
          <MiniAppProvider>{children}</MiniAppProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
