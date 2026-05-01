import "./globals.css";

export const metadata = {
  title: "FluxOdds — Find the Edge. Beat the Books.",
  description: "Real-time arbitrage detection across 40+ sportsbooks. Guaranteed profit, zero guesswork.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}