import Link from 'next/link';

export default function VerifyPrPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 sm:p-10">
        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-400">
          Coming Soon
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">
          PR Verification Is Coming Soon
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          We&apos;re putting the finishing touches on video PR verification with Partnered
          Gyms. Check back soon to submit your Squat, Bench, and Deadlift lifts for
          official verification.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/leaderboard"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
          >
            View Leaderboard
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
