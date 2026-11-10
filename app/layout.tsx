import type { Metadata } from "next";
import { Courier_Prime, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = Space_Mono({
  variable: "--font-telemetry",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const tape = Courier_Prime({
  variable: "--font-tape",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aircon IR coder",
  description:
    "Generate aircon IR codes for SmartIR (Broadlink, UFO-R11, ESPHome and more) and Flipper Zero from the protocol, for dozens of brands.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable} ${tape.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
