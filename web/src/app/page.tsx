import Link from 'next/link';

const FEATURES = [
  {
    title: 'GPS-Verified Gym Streaks',
    description:
      'Set your weekly target and automatically verify 15-minute gym visits via geofencing—or check in manually at home gyms.',
    badge: 'Consistency',
  },
  {
    title: 'Global & Gym Leaderboards',
    description:
      'Compare Verified Streaks, Total Gym Time, and Squat / Bench / Deadlift PRs against athletes at your gym or worldwide.',
    badge: 'Competition',
  },
  {
    title: 'Partnered Gym Lobby TVs',
    description:
      'Gym owners get a live kiosk display for lobby TVs plus a portal to review and verify member PR lift videos.',
    badge: 'For Gyms',
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-400">
          Gym Consistency & Verified PRs
        </span>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl">
          Turn Showing Up Into an Unbreakable Streak.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Inertia tracks your weekly gym goals with 15-minute GPS verification, powers live
          gym-by-gym leaderboards, and lets partnered gyms verify member PRs.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/leaderboard"
            className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 sm:w-auto"
          >
            View Live Leaderboard
          </Link>
          <Link
            href="/partners"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-3.5 text-sm font-bold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 sm:w-auto"
          >
            Become a Partnered Gym
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-5 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6"
          >
            <span className="inline-block rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
              {f.badge}
            </span>
            <h2 className="mt-4 text-lg font-extrabold text-white">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {f.description}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 sm:flex sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-extrabold text-white">
            Own or Manage a Gym?
          </h3>
          <p className="mt-1.5 max-w-xl text-sm text-zinc-400">
            Put your gym&apos;s live leaderboard on a lobby TV and verify member Squat, Bench,
            and Deadlift PRs from one dashboard.
          </p>
        </div>
        <div className="mt-5 flex gap-3 sm:mt-0">
          <Link
            href="/partners"
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
          >
            Partner Signup
          </Link>
          <Link
            href="/owner"
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
          >
            Owner Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}
