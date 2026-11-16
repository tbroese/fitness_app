import { WorkoutSession } from '../../types/fitness';

export interface RemoteLeaderboardUser {
  id: string;
  fullName: string;
  gymId: string | null;
  gymName: string;
  currentStreak: number;
  bestStreak: number;
  totalGymTimeMinutes: number;
  workoutsCount: number;
  weeklyGoal: number;
  updatedAt: string;
}

export interface UserCloudSyncData {
  userId: string;
  fullName: string;
  gymId: string | null;
  gymName: string | null;
  currentStreak: number;
  bestStreak: number;
  totalGymTimeMinutes: number;
  workoutsCount: number;
  weeklyGoal: number;
  unsyncedWorkouts?: WorkoutSession[];
}

export interface FetchLeaderboardParams {
  category: 'global' | 'gym' | 'friends';
  gymId?: string | null;
  gymName?: string | null;
  friendIds?: string[];
  limit?: number;
}

/**
 * Database-agnostic interface for cloud user storage and leaderboards.
 *
 * Migration Strategy:
 * All screens and contexts talk exclusively to `CloudDatabaseProvider`.
 * Currently backed by `SupabaseDatabaseProvider`, but you can swap in a
 * custom REST/PostgreSQL/Firebase provider in `src/services/cloud/index.ts`
 * without changing any UI or state logic.
 */
export interface CloudDatabaseProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  syncUserStats(data: UserCloudSyncData): Promise<{
    success: boolean;
    syncedWorkoutIds: string[];
  }>;
  fetchLeaderboard(params: FetchLeaderboardParams): Promise<RemoteLeaderboardUser[]>;
}
