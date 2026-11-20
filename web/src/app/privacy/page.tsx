import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Inertia',
  description: 'How Inertia handles location, workout data, and account deletion.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-black tracking-tight text-white">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-400">Effective Date: November 19, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-zinc-300">
        <section>
          <h2 className="text-lg font-bold text-white">1. Information We Collect</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-zinc-400">
            <li>
              <strong className="text-zinc-200">Account &amp; Profile Info:</strong> Display
              name, 4-digit user tag, optional email (when signing in with Google/Apple),
              optional age/gender, and personal records (Squat, Bench, Deadlift).
            </li>
            <li>
              <strong className="text-zinc-200">Workout &amp; Streak Data:</strong> Selected
              gym, weekly goal, workout timestamps, session durations, and streak counts.
            </li>
            <li>
              <strong className="text-zinc-200">Location Data (Optional / Permission-Gated):</strong>{' '}
              Foreground and background location are used solely to verify that you arrived
              at and stayed within your selected gym&apos;s geofence perimeter (50m–150m) for at
              least 15 minutes to verify a workout.
            </li>
            <li>
              <strong className="text-zinc-200">User Reports &amp; PR Verifications:</strong>{' '}
              Gym address reports, bug reports, and PR verification video links submitted by you.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white">2. How Background Location Is Used</h2>
          <p className="mt-2 text-zinc-400">
            Inertia never sells your location history or tracks your movements outside of
            checking whether you are inside your configured gym perimeter. You can disable
            Auto-Tracking anytime inside the app or switch to Manual Check-In/Out.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white">3. Public Leaderboards</h2>
          <p className="mt-2 text-zinc-400">
            Athletes who select a Verified Gym appear on Global and Gym leaderboards with
            their display name, gym name, streak counts, total gym time, and PRs. Custom/home
            gyms only appear on Personal and mutual Friends views.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white">4. Account &amp; Data Deletion</h2>
          <p className="mt-2 text-zinc-400">
            You can permanently delete your account and all associated workout, streak, and
            friend data directly in the mobile app under{' '}
            <strong className="text-zinc-200">Profile → Settings → Delete Account</strong>, or
            by emailing{' '}
            <a
              href="mailto:support@inertialeaderboard.com"
              className="text-blue-400 underline"
            >
              support@inertialeaderboard.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white">5. Contact</h2>
          <p className="mt-2 text-zinc-400">
            Questions about this Privacy Policy? Contact us at{' '}
            <a
              href="mailto:support@inertialeaderboard.com"
              className="text-blue-400 underline"
            >
              support@inertialeaderboard.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
