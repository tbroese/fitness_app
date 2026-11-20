import Link from 'next/link';

export default function PartnerSuccessPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-2xl text-emerald-400">
          ✓
        </span>
        <h1 className="mt-4 text-2xl font-black text-white">
          Welcome to Inertia Partnered Gyms!
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          Your payment succeeded. Check your owner email for your Inertia Owner Portal
          invite link, then sign in to launch your Lobby TV Leaderboard and review PR
          submissions.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/owner"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
          >
            Go to Owner Portal
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
          >
            View Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
