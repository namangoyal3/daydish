import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DayDish — Your Daily Kitchen Copilot",
  description: "An AI cooking day planner for Indian vegetarian meals, timelines, groceries, substitutions, and budgets.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "DayDish — Your Daily Kitchen Copilot",
    description: "Three meals. One optimized cooking timeline. Every rupee checked.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body>{children}</body></html>;
}
