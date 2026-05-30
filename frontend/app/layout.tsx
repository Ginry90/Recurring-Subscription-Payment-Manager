import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stellar Subscription Billing Manager",
  description: "Secure, decentralized, recurring subscription payments and automated escrow billing on the Stellar Testnet network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-neutral-950 text-neutral-100 antialiased selection:bg-blue-500/30 selection:text-blue-200">
        <div className="min-h-full flex flex-col justify-between">
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
