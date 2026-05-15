import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoalOS",
  description: "Enterprise goal setting and tracking portal"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
