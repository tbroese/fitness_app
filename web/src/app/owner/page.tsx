'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface GymOwnerRecord {
  id: string;
  email: string;
  full_name: string | null;
  gym_id: string;
  gym_name: string;
  subscription_status: string;
}

interface PrVerificationItem {
  id: string;
  user_id: string;
  user_name: string;
  gym_id: string;
  gym_name: string;
  lift_type: 'squat' | 'bench' | 'deadlift';
  weight_kg: number;
  video_url: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function OwnerPortalPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [owner, setOwner] = useState<GymOwnerRecord | null>(null);
  const [prs, setPrs] = useState<PrVerificationItem[]>([]);
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadOwnerData = useCallback(async (token: string, authUserId: string) => {
    if (!supabase) return;
    setLoading(true);
    const { data: ownerData } = await supabase
      .from('gym_owners')
      .select('id, email, full_name, gym_id, gym_name, subscription_status')
      .eq('auth_user_id', authUserId)
      .single();

    if (ownerData) {
      setOwner(ownerData as GymOwnerRecord);
      const { data: prData } = await supabase
        .from('pr_verifications')
        .select('*')
        .eq('gym_id', ownerData.gym_id)
        .order('created_at', { ascending: false });
      if (prData) setPrs(prData as PrVerificationItem[]);
    } else {
      setOwner(null);
    }
    setAccessToken(token);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        loadOwnerData(data.session.access_token, data.session.user.id);
      } else {
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        loadOwnerData(session.access_token, session.user.id);
      } else {
        setAccessToken(null);
        setOwner(null);
        setLoading(false);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadOwnerData]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !emailInput.trim()) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: emailInput.trim(),
      options: { emailRedirectTo: `${window.location.origin}/owner` },
    });
    if (!error) setLinkSent(true);
  };

  const handleReview = async (
    verificationId: string,
    decision: 'approved' | 'rejected'
  ) => {
    if (!accessToken) return;
    setActionMsg(null);
    const res = await fetch('/api/owner/review-pr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ verificationId, decision }),
    });
    const data = await res.json();
    if (res.ok) {
      setPrs((prev) =>
        prev.map((p) => (p.id === verificationId ? { ...p, status: decision } : p))
      );
      setActionMsg(
        decision === 'approved'
          ? 'PR approved and athlete leaderboard updated.'
          : 'PR submission rejected.'
      );
    } else {
      setActionMsg(data.error || 'Could not update PR status.');
    }
  };

  const handleBillingPortal = async () => {
    if (!accessToken) return;
    const res = await fetch('/api/billing-portal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const visiblePrs = prs.filter((p) =>
    tab === 'pending' ? p.status === 'pending' : p.status !== 'pending'
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-black tracking-tight text-white">
        Gym Owner Portal
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Launch your lobby TV leaderboard and verify athlete PR lift videos.
      </p>

      {!supabase ? (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
          Configure Supabase keys in <code className="text-zinc-200">web/.env.local</code>.
        </div>
      ) : loading ? (
        <div className="mt-6 text-sm text-zinc-400">Loading portal...</div>
      ) : !accessToken ? (
        <form
          onSubmit={handleSignIn}
          className="mt-6 max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6"
        >
          <h2 className="text-lg font-bold text-white">Owner Sign In</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Use the email address from your Partnered Gym signup.
          </p>
          <input
            type="email"
            required
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="owner@gym.com"
            className="mt-4 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
          >
            Send Magic Sign-In Link
          </button>
          {linkSent && (
            <p className="mt-3 text-xs font-semibold text-emerald-400">
              Magic link sent! Check your email to sign in.
            </p>
          )}
        </form>
      ) : !owner ? (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <p className="text-sm text-zinc-300">
            No active Partnered Gym is linked to this account yet.
          </p>
          <Link
            href="/partners"
            className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
          >
            Apply as a Partnered Gym
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 sm:flex-row sm:items-center">
            <div>
              <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold uppercase text-emerald-400">
                {owner.subscription_status}
              </span>
              <h2 className="mt-2 text-xl font-extrabold text-white">
                {owner.gym_name}
              </h2>
              <p className="text-xs text-zinc-400">{owner.email}</p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Link
                href={`/gym/${encodeURIComponent(owner.gym_id)}/display`}
                target="_blank"
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
              >
                Launch Lobby TV Display
              </Link>
              <button
                type="button"
                onClick={handleBillingPortal}
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold text-zinc-200 hover:bg-zinc-800"
              >
                Manage Billing
              </button>
              <button
                type="button"
                onClick={() => supabase?.auth.signOut()}
                className="rounded-xl border border-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-400 hover:text-white"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-white">
                PR Verification Queue
              </h3>
              <div className="flex gap-2">
                {(['pending', 'reviewed'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
                      tab === t
                        ? 'bg-blue-600 text-white'
                        : 'border border-zinc-800 bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {actionMsg && (
              <p className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
                {actionMsg}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {visiblePrs.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
                  No {tab} PR submissions right now.
                </div>
              ) : (
                visiblePrs.map((pr) => (
                  <div
                    key={pr.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-bold text-white">
                        {pr.user_name}{' '}
                        <span className="text-blue-400 capitalize">
                          • {pr.lift_type} {Math.round(pr.weight_kg * 2.20462)} lbs (
                          {Math.round(pr.weight_kg)} kg)
                        </span>
                      </p>
                      <a
                        href={pr.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-semibold text-blue-400 underline"
                      >
                        Watch Lift Video ↗
                      </a>
                      {pr.notes && (
                        <p className="mt-1 text-xs text-zinc-400">{pr.notes}</p>
                      )}
                    </div>

                    {pr.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReview(pr.id, 'approved')}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReview(pr.id, 'rejected')}
                          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                          pr.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {pr.status}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
