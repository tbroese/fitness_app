import Link from 'next/link';

const NAV_LINKS = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/partners', label: 'Partner Gyms' },
  { href: '/verify-pr', label: 'Verify PR' },
  { href: '/owner', label: 'Owner Portal' },
  { href: '/privacy', label: 'Privacy' },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-black text-white">
            I
          </span>
          <span className="text-lg font-extrabold tracking-tight text-white">
            Inertia
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800/80 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
