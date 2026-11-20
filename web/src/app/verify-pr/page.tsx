'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type LiftType = 'squat' | 'bench' | 'deadlift';

interface PrSubmissionRow {
  id: string;
  lift_type: LiftType;
  weight_kg: number;
  gym_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

function VerifyPrContent() {
  const searchParams = useSearchParams();
  const [userIdParam] = useState(() => searchParams.get('userId') || '');
  const [userNameParam, setUserNameParam] = useState(
    () => searchParams.get('userName') || ''
  );
  const [gymIdParam] = useState(() => searchParams.get('gymId') || '');
  const [gymNameParam, setGymNameParam] = useState(
    () => searchParams.get('gymName') || ''
  );

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [liftType, setLiftType] = useState<LiftType>('squat');
  const [weightInput, setWeightInput] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [videoUrl, setVideoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<PrSubmissionRow[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setAuthUserId(data.session?.user?.id || null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUserId(session?.user?.id || null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !authUserId) return;
    supabase
      .from('pr_verifications')
      .select('id, lift_type, weight_kg, gym_name, status, created_at')
      .eq('auth_user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setSubmissions(data as PrSubmissionRow[]);
      });
  }, [authUserId, message]);

  const handleSendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !authEmail.trim()) return;
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    if (error) {
      setErrorMsg(error.message);
    } else {
      setMagicLinkSent(true);
    }
  };

  const handleSubmitPr = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !authUserId) return;
    setErrorMsg(null);
    setMessage(null);

    const parsed = parseFloat(weightInput);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg('Please enter a valid weight.');
      return;
    }

    const weightKg = unit === 'kg' ? parsed : parsed / 2.20462;
    if (weightKg > 550) {
      setErrorMsg('Weight exceeds the maximum allowed limit (550 kg / 1212 lbs).');
      return;
    }

    setSubmitting(true);
    try {
      const id = `prv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { error } = await supabase.from('pr_verifications').insert({
        id,
        user_id: userIdParam || authUserId,
        auth_user_id: authUserId,
        user_name: userNameParam.trim() || 'Inertia Athlete',
        gym_id: gymIdParam || null,
        gym_name: gymNameParam.trim() || 'Verified Gym',
        lift_type: liftType,
        weight_kg: Number(weightKg.toFixed(2)),
        video_url: videoUrl.trim(),
        notes: notes.trim() || null,
        status: 'pending',
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setWeightInput('');
        setVideoUrl('');
        setNotes('');
        setMessage('PR verification submitted! Your gym owner will review it soon.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-black tracking-tight text-white">
        Submit PR for Verification
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Submit a lift video link so your Partnered Gym can verify your Squat, Bench, or
        Deadlift PR.
      </p>

      {!supabase ? (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
          Supabase environment variables are not configured in <code className="text-zinc-200">web/.env.local</code>.
        </div>
      ) : !authUserId ? (
        <form
          onSubmit={handleSendMagicLink}
          className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6"
        >
          <h2 className="text-lg font-bold text-white">Sign in to Submit</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Enter your email to receive a one-click sign-in link.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
            >
              Send Link
            </button>
          </div>
          {magicLinkSent && (
            <p className="mt-3 text-xs font-semibold text-emerald-400">
              Check your inbox and click the sign-in link to continue.
            </p>
          )}
          {errorMsg && <p className="mt-3 text-xs text-red-400">{errorMsg}</p>}
        </form>
      ) : (
        <form
          onSubmit={handleSubmitPr}
          className="mt-6 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-300">
                Your Name *
              </label>
              <input
                required
                value={userNameParam}
                onChange={(e) => setUserNameParam(e.target.value)}
                placeholder="Athlete name"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-300">
                Gym Name *
              </label>
              <input
                required
                value={gymNameParam}
                onChange={(e) => setGymNameParam(e.target.value)}
                placeholder="Your gym name"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-zinc-300">Lift</label>
            <div className="grid grid-cols-3 gap-2">
              {(['squat', 'bench', 'deadlift'] as const).map((lift) => (
                <button
                  key={lift}
                  type="button"
                  onClick={() => setLiftType(lift)}
                  className={`rounded-xl py-2.5 text-xs font-bold capitalize transition ${
                    liftType === lift
                      ? 'bg-blue-600 text-white'
                      : 'border border-zinc-800 bg-zinc-950 text-zinc-300'
                  }`}
                >
                  {lift}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-bold text-zinc-300">
                Weight *
              </label>
              <input
                required
                type="number"
                step="0.5"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder={unit === 'lbs' ? '315' : '143'}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-300">Unit</label>
              <div className="flex h-[42px] rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                {(['lbs', 'kg'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`flex-1 rounded-lg text-xs font-bold ${
                      unit === u ? 'bg-blue-600 text-white' : 'text-zinc-400'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-zinc-300">
              Video Link (YouTube, Instagram, Google Drive, TikTok) *
            </label>
            <input
              required
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-zinc-300">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for your gym reviewer..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {errorMsg}
            </p>
          )}
          {message && (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit for Verification'}
          </button>
        </form>
      )}

      {submissions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Your Recent Submissions
          </h2>
          <div className="mt-3 space-y-2">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-bold capitalize text-white">
                    {s.lift_type} • {Math.round(s.weight_kg * 2.20462)} lbs (
                    {Math.round(s.weight_kg)} kg)
                  </p>
                  <p className="text-xs text-zinc-400">{s.gym_name}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                    s.status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : s.status === 'rejected'
                      ? 'bg-red-500/15 text-red-400'
                      : 'bg-amber-500/15 text-amber-400'
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyPrPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-zinc-400">
          Loading...
        </div>
      }
    >
      <VerifyPrContent />
    </Suspense>
  );
}
