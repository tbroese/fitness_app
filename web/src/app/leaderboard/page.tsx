'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type MetricKey =
  | 'verified_streak'
  | 'best_verified_streak'
  | 'total_gym_time_minutes'
  | 'squat_pr_kg'
  | 'bench_pr_kg'
  | 'deadlift_pr_kg'
  | 'total_pr_kg';

interface LeaderboardRow {
  id: string;
  full_name: string;
  user_tag: string;
  gym_name: string | null;
  verified_streak: number;
  best_verified_streak: number;
  total_gym_time_minutes: number;
  squat_pr_kg: number;
  bench_pr_kg: number;
  deadlift_pr_kg: number;
}

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'verified_streak', label: 'Verified Streak' },
  { key: 'best_verified_streak', label: 'Best Streak' },
  { key: 'total_gym_time_minutes', label: 'Gym Time' },
  { key: 'total_pr_kg', label: 'Total PRs' },
  { key: 'squat_pr_kg', label: 'Squat' },
  { key: 'bench_pr_kg', label: 'Bench' },
  { key: 'deadlift_pr_kg', label: 'Deadlift' },
];

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatWeight(kg: number, unit: 'lbs' | 'kg'): string {
  if (!kg) return '—';
  if (unit === 'kg') return `${Math.round(kg)} kg`;
  return `${Math.round(kg * 2.20462)} lbs`;
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<MetricKey>('verified_streak');
  const [gymFilter, setGymFilter] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('leaderboard_users')
        .select(
          'id, full_name, user_tag, gym_name, verified_streak, best_verified_streak, total_gym_time_minutes, squat_pr_kg, bench_pr_kg, deadlift_pr_kg'
        )
        .limit(200);

      if (active && data) {
        setRows(data as LeaderboardRow[]);
      }
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const sorted = useMemo(() => {
    const q = gymFilter.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => (r.gym_name || '').toLowerCase().includes(q))
      : rows;

    const getVal = (r: LeaderboardRow): number => {
      if (metric === 'total_pr_kg') {
        return (r.squat_pr_kg || 0) + (r.bench_pr_kg || 0) + (r.deadlift_pr_kg || 0);
      }
      return Number(r[metric] || 0);
    };

    return [...filtered].sort((a, b) => getVal(b) - getVal(a));
  }, [rows, gymFilter, metric]);

  const formatMetric = (r: LeaderboardRow): string => {
    switch (metric) {
      case 'verified_streak':
        return `${r.verified_streak || 0} 🔥`;
      case 'best_verified_streak':
        return `${r.best_verified_streak || 0} 🏆`;
      case 'total_gym_time_minutes':
        return formatDuration(r.total_gym_time_minutes || 0);
      case 'total_pr_kg':
        return formatWeight(
          (r.squat_pr_kg || 0) + (r.bench_pr_kg || 0) + (r.deadlift_pr_kg || 0),
          unit
        );
      default:
        return formatWeight(r[metric] || 0, unit);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Inertia Leaderboard
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Verified gym athletes ranked by consistency, time, and strength.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={gymFilter}
            onChange={(e) => setGymFilter(e.target.value)}
            placeholder="Filter by gym name..."
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
          <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            {(['lbs', 'kg'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                  unit === u ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              metric === m.key
                ? 'bg-blue-600 text-white'
                : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
        {!supabase ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            Configure <code className="text-zinc-200">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="text-zinc-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
            <code className="text-zinc-200">web/.env.local</code> to load live rankings.
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-zinc-400">Loading rankings...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            No verified athletes match this filter yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {sorted.map((row, idx) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-900"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                      idx === 0
                        ? 'bg-amber-500/20 text-amber-300'
                        : idx === 1
                        ? 'bg-zinc-400/20 text-zinc-200'
                        : idx === 2
                        ? 'bg-orange-500/20 text-orange-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">
                      {row.full_name}{' '}
                      <span className="text-xs font-semibold text-zinc-500">
                        #{row.user_tag}
                      </span>
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {row.gym_name || 'Verified Gym'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-base font-extrabold text-blue-400">
                    {formatMetric(row)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
