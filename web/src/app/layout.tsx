import type { Metadata, Viewport } from "next";
import { Caprasimo, Manrope, Yeseva_One } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

// Organic: Caprasimo для заголовков и цифр; у него нет кириллицы, поэтому
// русские буквы заголовков берёт Yeseva One. Текст — Manrope (кириллица).
const caprasimo = Caprasimo({
  subsets: ["latin"],
  variable: "--font-caprasimo",
  weight: "400",
  display: "swap",
});

const yeseva = Yeseva_One({
  subsets: ["latin", "cyrillic"],
  variable: "--font-yeseva",
  weight: "400",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Здоровье семьи",
  description: "Семейный дашборд здоровья",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5ead8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${caprasimo.variable} ${yeseva.variable} ${manrope.variable}`}>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
