import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helio CRM | Solar operations, in sync",
  description: "Your solar customers, next steps and team updates in one calm workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
