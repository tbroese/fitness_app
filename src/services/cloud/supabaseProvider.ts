import { SUPABASE_CONFIG } from '../../constants/config';
import {
  CloudDatabaseProvider,
  FetchLeaderboardParams,
  RemoteLeaderboardUser,
  UserCloudSyncData,
} from './types';

interface SupabaseLeaderboardRow {
  id: string;
  full_name: string;
  gym_id: string | null;
  gym_name: string | null;
  current_streak: number;
  best_streak: number;
  total_gym_time_minutes: number;
  workouts_count: number;
  weekly_goal: number;
  updated_at: string;
}

/**
 * Lightweight Supabase PostgREST implementation of `CloudDatabaseProvider`.
 *
 * Uses standard `fetch` calls to Supabase's REST API so there is zero vendor
 * SDK lock-in and minimal bandwidth/connection usage on the Supabase Free Tier.
 */
export class SupabaseDatabaseProvider implements CloudDatabaseProvider {
  readonly providerName = 'supabase';

  isConfigured(): boolean {
    return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
  }

  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: SUPABASE_CONFIG.anonKey,
      'Content-Type': 'application/json',
      ...extra,
    };
    if (SUPABASE_CONFIG.anonKey.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${SUPABASE_CONFIG.anonKey}`;
    }
    return headers;
  }

  async syncUserStats(data: UserCloudSyncData): Promise<{
    success: boolean;
    syncedWorkoutIds: string[];
  }> {
    if (!this.isConfigured()) {
      return { success: false, syncedWorkoutIds: [] };
    }

    // Do not push blank anonymous users before onboarding is completed
    const trimmedName = data.fullName.trim();
    if (!data.userId || !trimmedName) {
      return { success: false, syncedWorkoutIds: [] };
    }

    try {
      const nowIso = new Date().toISOString();
      const userPayload: SupabaseLeaderboardRow = {
        id: data.userId,
        full_name: trimmedName,
        gym_id: data.gymId || null,
        gym_name: data.gymName || null,
        current_streak: data.currentStreak,
        best_streak: data.bestStreak,
        total_gym_time_minutes: data.totalGymTimeMinutes,
        workouts_count: data.workoutsCount,
        weekly_goal: data.weeklyGoal,
        updated_at: nowIso,
      };

      const userRes = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/leaderboard_users?on_conflict=id`,
        {
          method: 'POST',
          headers: this.getHeaders({
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify(userPayload),
        }
      );

      if (!userRes.ok) {
        const errText = await userRes.text();
        console.warn('[Supabase] Failed to upsert leaderboard_users:', errText);
        return { success: false, syncedWorkoutIds: [] };
      }

      const syncedWorkoutIds: string[] = [];
      if (data.unsyncedWorkouts && data.unsyncedWorkouts.length > 0) {
        const workoutRows = data.unsyncedWorkouts.map((w) => ({
          id: w.id,
          user_id: data.userId,
          gym_name: w.gymName,
          date_string: w.dateString,
          week_id: w.weekId,
          duration_minutes: w.durationMinutes,
          verified_by_gps: w.verifiedByGps,
          workout_timestamp: w.timestamp,
          updated_at: w.updatedAt || nowIso,
        }));

        const workoutsRes = await fetch(
          `${SUPABASE_CONFIG.url}/rest/v1/user_workouts?on_conflict=id`,
          {
            method: 'POST',
            headers: this.getHeaders({
              Prefer: 'resolution=merge-duplicates,return=minimal',
            }),
            body: JSON.stringify(workoutRows),
          }
        );

        if (workoutsRes.ok) {
          for (const w of data.unsyncedWorkouts) {
            syncedWorkoutIds.push(w.id);
          }
        }
      }

      return { success: true, syncedWorkoutIds };
    } catch (error) {
      console.warn('[Supabase] Error syncing user stats:', error);
      return { success: false, syncedWorkoutIds: [] };
    }
  }

  async fetchLeaderboard(
    params: FetchLeaderboardParams
  ): Promise<RemoteLeaderboardUser[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const limit = params.limit || 100;
      const queryParts: string[] = [
        'select=id,full_name,gym_id,gym_name,current_streak,best_streak,total_gym_time_minutes,workouts_count,weekly_goal,updated_at',
        `limit=${limit}`,
      ];

      if (params.category === 'gym') {
        if (params.gymId) {
          queryParts.push(`gym_id=eq.${encodeURIComponent(params.gymId)}`);
        } else if (params.gymName) {
          queryParts.push(`gym_name=eq.${encodeURIComponent(params.gymName)}`);
        } else {
          // User hasn't selected a home gym yet
          return [];
        }
      } else if (params.category === 'friends') {
        if (!params.friendIds || params.friendIds.length === 0) {
          return [];
        }
        const inList = params.friendIds.map((id) => `"${id}"`).join(',');
        queryParts.push(`id=in.(${encodeURIComponent(inList)})`);
      }

      const url = `${SUPABASE_CONFIG.url}/rest/v1/leaderboard_users?${queryParts.join('&')}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn('[Supabase] Failed to fetch leaderboard:', errText);
        return [];
      }

      const rows: SupabaseLeaderboardRow[] = await res.json();
      return rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        gymId: row.gym_id,
        gymName: row.gym_name || 'No Gym Selected',
        currentStreak: row.current_streak ?? 0,
        bestStreak: row.best_streak ?? 0,
        totalGymTimeMinutes: row.total_gym_time_minutes ?? 0,
        workoutsCount: row.workouts_count ?? 0,
        weeklyGoal: row.weekly_goal ?? 1,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.warn('[Supabase] Error fetching leaderboard:', error);
      return [];
    }
  }
}
