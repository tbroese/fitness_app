'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface DisplayUserRow {
  id: string;
  full_name: string;
  user_tag: string;
  gym_name: string | null;
  verified_streak: number;
  total_gym_time_minutes: number;
  squat_pr_kg: number;
  bench_pr_kg: number;
  deadlift_pr_kg: number;
}

type BoardMode = 'verified_streak' | 'total_gym_time_minutes' | 'total_pr_kg';

const MODES: { key: BoardMode; title: string }[] = [
  { key: 'verified_streak', title: 'Top Verified Streaks' },
  { key: 'total_gym_time_minutes', title: 'Most Time in Gym' },
  { key: 'total_pr_kg', title: 'Big 3 PR Totals' },
];

function GymTvDisplayContent() {
  const params = useParams<{ gymId: string }>();
  const gymId = decodeURIComponent(params.gymId || '');
  const [rows, setRows] = useState<DisplayUserRow[]>([]);
  const [gymTitle, setGymTitle] = useState('Gym Leaderboard');
  const [modeIndex, setModeIndex] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchGymBoard() {
      if (!supabase || !gymId) return;
      const [{ data: gymInfo }, { data: members }] = await Promise.all([
        supabase.from('gyms').select('name').eq('id', gymId).single(),
        supabase
          .from('leaderboard_users')
          .select(
            'id, full_name, user_tag, gym_name, verified_streak, total_gym_time_minutes, squat_pr_kg, bench_pr_kg, deadlift_pr_kg'
          )
          .eq('gym_id', gymId)
          .eq('is_verified', true)
          .limit(50),
      ]);

      if (!active) return;
      if (gymInfo?.name) setGymTitle(gymInfo.name);
      if (members) {
        setRows(members as DisplayUserRow[]);
        if (!gymInfo?.name && members[0]?.gym_name) {
          setGymTitle(members[0].gym_name);
        }
      }
    }

    fetchGymBoard();
    const refreshTimer = setInterval(fetchGymBoard, 30000);
    const cycleTimer = setInterval(
      () => setModeIndex((prev) => (prev + 1) % MODES.length),
      15000
    );

    return () => {
      active = false;
      clearInterval(refreshTimer);
      clearInterval(cycleTimer);
    };
  }, [gymId]);

  const activeMode = MODES[modeIndex];

  const sorted = useMemo(() => {
    const val = (r: DisplayUserRow) => {
      if (activeMode.key === 'total_pr_kg') {
        return (r.squat_pr_kg || 0) + (r.bench_pr_kg || 0) + (r.deadlift_pr_kg || 0);
      }
      return Number(r[activeMode.key] || 0);
    };
    return [...rows].sort((a, b) => val(b) - val(a)).slice(0, 10);
  }, [rows, activeMode]);

  const formatScore = (r: DisplayUserRow) => {
    if (activeMode.key === 'verified_streak') return `${r.verified_streak || 0} 🔥`;
    if (activeMode.key === 'total_gym_time_minutes') {
      const h = Math.floor((r.total_gym_time_minutes || 0) / 60);
      const m = (r.total_gym_time_minutes || 0) % 60;
      return `${h}h ${m}m`;
    }
    const totalKg =
      (r.squat_pr_kg || 0) + (r.bench_pr_kg || 0) + (r.deadlift_pr_kg || 0);
    return `${Math.round(totalKg * 2.20462)} lbs`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-white sm:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
              Inertia Live Gym Display
            </p>
            <h1 className="mt-1 text-3xl font-black sm:text-5xl">{gymTitle}</h1>
          </div>

          <div className="flex gap-2">
            {MODES.map((m, idx) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setModeIndex(idx)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  idx === modeIndex
                    ? 'bg-blue-600 text-white'
                    : 'border border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>

        <h2 className="mt-6 text-xl font-extrabold text-zinc-200">
          {activeMode.title}
        </h2>

        <div className="mt-4 grid gap-3">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center text-zinc-400">
              Waiting for verified members at this gym...
            </div>
          ) : (
            sorted.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 px-6 py-4"
              >
                <div className="flex items-center gap-5">
                  <span className="text-2xl font-black text-blue-400">#{i + 1}</span>
                  <div>
                    <p className="text-xl font-bold text-white">
                      {r.full_name}{' '}
                      <span className="text-sm font-semibold text-zinc-500">
                        #{r.user_tag}
                      </span>
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-black text-emerald-400">
                  {formatScore(r)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function GymTvDisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-400">
          Loading gym display...
        </div>
      }
    >
      <GymTvDisplayContent />
    </Suspense>
  );
}
