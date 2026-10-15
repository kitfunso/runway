import type { Metadata } from "next";
import "./globals.css";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-instrument-serif' });

export const metadata: Metadata = {
  title: "Runway",
  description: "Treasury agent that pays its own invoices and keeps the cash floor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body className="bg-paper text-ink font-sans">{children}</body>
    </html>
  );
}
