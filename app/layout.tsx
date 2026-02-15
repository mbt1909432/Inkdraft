import type { Metadata } from "next";
import { Geist, Noto_Serif_SC } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { LocaleProvider } from "@/contexts/LocaleContext";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "墨稿 · Inkdraft — 用 AI 写好每一稿",
  description: "Draft better with AI. 所见即所得 Markdown 编辑器，AI 编辑助手支持对话改稿、逐条确认、多轮重试，云端同步。",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

const notoSerifSC = Noto_Serif_SC({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-sc",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} ${notoSerifSC.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="guofeng"
          enableSystem
          disableTransitionOnChange
          themes={['guofeng', 'light', 'dark', 'sepia', 'system']}
        >
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
