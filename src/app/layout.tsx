import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import SfxProvider from "@/components/SfxProvider";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Galmuri11 (OFL, see fonts/Galmuri-OFL.md) - pixel font for the home map's
// titles and labels only; body text stays Noto Sans KR.
const galmuri = localFont({
  variable: "--font-galmuri",
  src: [
    { path: "./fonts/Galmuri11.woff2", weight: "400" },
    { path: "./fonts/Galmuri11-Bold.woff2", weight: "700" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Me:seum",
  description: "당신의 마음이 머무는 작은 전시공간, Me:seum",
  appleWebApp: { capable: true, title: "Me:seum", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#24452f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${galmuri.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <SfxProvider />
        {children}
      </body>
    </html>
  );
}
