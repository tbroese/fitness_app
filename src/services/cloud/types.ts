import { AuthProviderType, WorkoutSession } from '../../types/fitness';

export interface RemoteLeaderboardUser {
  id: string;
  fullName: string;
  userTag: string;
  email?: string | null;
  authProvider?: AuthProviderType;
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
  userTag: string;
  email?: string | null;
  authProvider?: AuthProviderType;
  authUserId?: string | null;
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

export interface FriendRequestWithUser {
  requestId: string;
  requesterId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  user: RemoteLeaderboardUser;
}

export interface FriendshipsOverview {
  friends: RemoteLeaderboardUser[];
  incomingRequests: FriendRequestWithUser[];
  outgoingRequests: FriendRequestWithUser[];
}

/**
 * Database-agnostic interface for cloud user storage, authentication lookup,
 * mutual friend requests, and leaderboards.
 *
 * Migration Strategy:
 * All screens and contexts talk exclusively to `CloudDatabaseProvider`.
 * Currently backed by `SupabaseDatabaseProvider`, but you can swap in a
 * custom REST/PostgreSQL/Firebase provider in `src/services/cloud/index.ts`
 * without changing any UI or state logic.
 */
export interface OAuthUserIdentity {
  authUserId: string;
  email: string;
  fullName: string;
  provider: 'google' | 'apple';
}

export interface CloudDatabaseProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  getOAuthAuthorizeUrl(provider: 'google' | 'apple', redirectUri: string): string | null;
  getUserFromAccessToken(
    accessToken: string,
    fallbackProvider: 'google' | 'apple'
  ): Promise<OAuthUserIdentity | null>;
  findExistingUserByEmail(email: string): Promise<RemoteLeaderboardUser | null>;
  syncUserStats(data: UserCloudSyncData): Promise<{
    success: boolean;
    syncedWorkoutIds: string[];
  }>;
  fetchLeaderboard(params: FetchLeaderboardParams): Promise<RemoteLeaderboardUser[]>;
  searchUsers(query: string, currentUserId: string): Promise<RemoteLeaderboardUser[]>;
  fetchFriendships(currentUserId: string): Promise<FriendshipsOverview>;
  sendFriendRequest(
    requesterId: string,
    receiverId: string
  ): Promise<{ success: boolean; autoAccepted?: boolean; message: string }>;
  respondToFriendRequest(requestId: string, accept: boolean): Promise<boolean>;
  deleteUserAccount(userId: string): Promise<boolean>;
}
