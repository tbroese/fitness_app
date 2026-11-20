import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inertia — Verified Gym Streaks & Leaderboards",
  description:
    "Build GPS-verified gym streaks, compete on Global and Gym leaderboards, and showcase live rankings on your gym's lobby TV.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-zinc-800/80 bg-zinc-950 py-8 text-sm text-zinc-400">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
            <p>© 2026 Inertia. Built for consistent athletes & gyms.</p>
            <div className="flex items-center gap-5">
              <Link href="/leaderboard" className="hover:text-white">
                Leaderboard
              </Link>
              <Link href="/partners" className="hover:text-white">
                Partner Gyms
              </Link>
              <Link href="/privacy" className="hover:text-white">
                Privacy Policy
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
