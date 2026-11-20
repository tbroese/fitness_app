'use client';

import { FormEvent, useState } from 'react';

const BENEFITS = [
  'Full-screen Lobby TV Leaderboard display for your gym',
  'Gym Owner Portal to review & verify member Squat / Bench / Deadlift PR videos',
  'Official Partnered Gym badge inside the Inertia mobile app & website',
];

export default function PartnersPage() {
  const [gymName, setGymName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gymName,
          address,
          city,
          state: stateCode,
          ownerName,
          ownerEmail,
          phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not start checkout.');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
            For Gym Owners
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Become an Inertia Partnered Gym
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Boost member retention with friendly competition. Display your gym&apos;s live
            leaderboard on a lobby TV and verify member PR lifts.
          </p>

          <ul className="mt-6 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-zinc-200">
                <span className="mt-0.5 text-emerald-400">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8"
        >
          <h2 className="text-xl font-extrabold text-white">Partner Gym Application</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Enter your gym details to continue to secure Stripe Checkout.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-300">
                Gym Name *
              </label>
              <input
                required
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="e.g. Powerhouse Gym Torrance"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-300">
                Street Address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="5130 W 190th St"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-300">City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Torrance"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-300">State</label>
                <input
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  placeholder="CA"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-300">
                Owner / Manager Name *
              </label>
              <input
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-300">
                  Owner Email *
                </label>
                <input
                  required
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@gym.com"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-300">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {submitting ? 'Redirecting to Checkout...' : 'Continue to Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
