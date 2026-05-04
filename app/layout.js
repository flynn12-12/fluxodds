import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "FluxOdds — Find the Edge. Beat the Books.",
  description: "Real-time arbitrage detection across 40+ sportsbooks. Guaranteed profit, zero guesswork.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased bg-zinc-950 text-zinc-100 flux-app-body`}>{children}</body>
    </html>
  );
}