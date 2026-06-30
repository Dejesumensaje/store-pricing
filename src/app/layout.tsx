import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  title: "Store Pricing | HyVee",
  description: "Store pricing management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${openSans.variable}`}>
      <body className="h-full flex flex-col bg-gray-50 antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-gray-900 focus:outline focus:outline-2 focus:outline-hyvee-red">Skip to main content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
