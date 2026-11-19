import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import { SUPABASE_CONFIG } from '../../constants/config';
import { AuthProviderType, UserGender } from '../../types/fitness';
import { PartneredGym } from '../../constants/partneredGyms';
import { calculateDistanceMeters } from '../locationService';
import {
  AuthSession,
  CloudDatabaseProvider,
  FetchLeaderboardParams,
  FriendRequestWithUser,
  FriendshipsOverview,
  GymReportInput,
  OAuthUserIdentity,
  RemoteLeaderboardUser,
  UserCloudSyncData,
} from './types';

/**
 * Builds the correct OAuth redirect URI:
 * - Inside Expo Go: returns `exp://<host:port>` (root path) so it matches `exp://**`
 *   in Supabase Redirect URLs and opens the home route `/` in Expo Go without
 *   triggering "Unmatched Route".
 * - In standalone APK/AAB builds: uses `fitnesstracker://auth-callback`.
 */
export function getOAuthRedirectUri(): string {
  const debuggerHost =
    (Constants.expoGoConfig as any)?.debuggerHost ||
    Constants.expoConfig?.hostUri ||
    (Constants.manifest2 as any)?.extra?.expoClient?.hostUri ||
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost;

  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo' ||
    Boolean(Constants.expoGoConfig);

  if (isExpoGo && debuggerHost) {
    const cleanHost = String(debuggerHost)
      .replace(/^[a-zA-Z0-9+.-]+:\/\//, '')
      .replace(/\/.*$/, '');
    return `exp://${cleanHost}/--/auth-callback`;
  }

  if (isExpoGo && Constants.experienceUrl?.startsWith('exp://')) {
    const cleanBase = Constants.experienceUrl.replace(/\/+$/, '');
    return `${cleanBase}/--/auth-callback`;
  }

  return 'fitnesstracker://auth-callback';
}

interface SupabaseLeaderboardRow {
  id: string;
  full_name: string;
  user_tag: string;
  email?: string | null;
  auth_provider?: string | null;
  auth_user_id?: string | null;
  gender?: string | null;
  age?: number | null;
  gym_id: string | null;
  gym_name: string | null;
  is_partnered?: boolean;
  current_streak: number;
  best_streak: number;
  partner_streak?: number;
  best_partner_streak?: number;
  total_gym_time_minutes: number;
  workouts_count: number;
  weekly_goal: number;
  squat_pr_kg?: number;
  bench_pr_kg?: number;
  deadlift_pr_kg?: number;
  updated_at: string;
}

interface SupabaseFriendRequestRow {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

function mapRowToLeaderboardUser(row: SupabaseLeaderboardRow): RemoteLeaderboardUser {
  return {
    id: row.id,
    fullName: row.full_name,
    userTag: row.user_tag || '0000',
    email: row.email ?? null,
    authProvider: (row.auth_provider as AuthProviderType) || 'device',
    gender:
      row.gender === 'male' || row.gender === 'female'
        ? (row.gender as UserGender)
        : null,
    age: typeof row.age === 'number' ? row.age : null,
    gymId: row.gym_id,
    gymName: row.gym_name || 'No Gym Selected',
    isPartnered: Boolean(row.is_partnered),
    currentStreak: row.current_streak ?? 0,
    bestStreak: row.best_streak ?? 0,
    partnerStreak: row.partner_streak ?? 0,
    bestPartnerStreak: row.best_partner_streak ?? 0,
    totalGymTimeMinutes: row.total_gym_time_minutes ?? 0,
    workoutsCount: row.workouts_count ?? 0,
    weeklyGoal: row.weekly_goal ?? 1,
    squatPrKg: row.squat_pr_kg ?? 0,
    benchPrKg: row.bench_pr_kg ?? 0,
    deadliftPrKg: row.deadlift_pr_kg ?? 0,
    updatedAt: row.updated_at,
  };
}

/**
 * Lightweight Supabase PostgREST implementation of `CloudDatabaseProvider`.
 *
 * Uses standard `fetch` calls to Supabase's REST API so there is zero vendor
 * SDK lock-in and minimal bandwidth/connection usage on the Supabase Free Tier.
 */
export class SupabaseDatabaseProvider implements CloudDatabaseProvider {
  readonly providerName = 'supabase';
  private authSession: AuthSession | null = null;

  isConfigured(): boolean {
    return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
  }

  setAuthSession(session: AuthSession | null): void {
    this.authSession = session;
  }

  async signInAnonymously(): Promise<AuthSession | null> {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_CONFIG.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.access_token) return null;
      const session: AuthSession = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined,
        authUserId: data.user?.id,
      };
      this.setAuthSession(session);
      return session;
    } catch (e) {
      console.warn('[Supabase] Anonymous sign-in failed:', e);
      return null;
    }
  }

  async refreshAuthSession(refreshToken: string): Promise<AuthSession | null> {
    if (!this.isConfigured() || !refreshToken) return null;
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_CONFIG.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.access_token) return null;
      const session: AuthSession = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined,
        authUserId: data.user?.id || this.authSession?.authUserId,
      };
      this.setAuthSession(session);
      return session;
    } catch (e) {
      console.warn('[Supabase] Failed to refresh auth session:', e);
      return null;
    }
  }

  private async ensureFreshSession(): Promise<void> {
    if (
      this.authSession?.expiresAt &&
      this.authSession.refreshToken &&
      Date.now() > this.authSession.expiresAt - 60_000
    ) {
      await this.refreshAuthSession(this.authSession.refreshToken);
    }
  }

  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: SUPABASE_CONFIG.anonKey,
      'Content-Type': 'application/json',
      ...extra,
    };
    if (this.authSession?.accessToken) {
      headers.Authorization = `Bearer ${this.authSession.accessToken}`;
    } else if (SUPABASE_CONFIG.anonKey.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${SUPABASE_CONFIG.anonKey}`;
    }
    return headers;
  }

  getOAuthAuthorizeUrl(provider: 'google' | 'apple', redirectUri: string): string | null {
    if (!this.isConfigured()) {
      return null;
    }
    return `${SUPABASE_CONFIG.url}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(
      redirectUri
    )}`;
  }

  async getUserFromAccessToken(
    accessToken: string,
    fallbackProvider: 'google' | 'apple'
  ): Promise<OAuthUserIdentity | null> {
    if (!this.isConfigured() || !accessToken) return null;

    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/user`, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_CONFIG.anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) return null;
      const userData = await res.json();
      const email: string = userData.email || '';
      const meta = userData.user_metadata || {};
      const fullName: string =
        meta.full_name ||
        meta.name ||
        (email ? email.split('@')[0] : 'Athlete');
      const provider =
        userData.app_metadata?.provider === 'apple' ? 'apple' : fallbackProvider;

      return {
        authUserId: userData.id,
        email,
        fullName,
        provider,
      };
    } catch (e) {
      console.warn('[Supabase] Failed to fetch OAuth user profile:', e);
      return null;
    }
  }

  async findExistingUserByEmail(email: string): Promise<RemoteLeaderboardUser | null> {
    if (!this.isConfigured()) return null;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    try {
      const url = `${SUPABASE_CONFIG.url}/rest/v1/leaderboard_users?email=ilike.${encodeURIComponent(
        cleanEmail
      )}&limit=1`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      const rows: SupabaseLeaderboardRow[] = await res.json();
      if (rows.length === 0) return null;
      return mapRowToLeaderboardUser(rows[0]);
    } catch (error) {
      console.warn('[Supabase] Error finding user by email:', error);
      return null;
    }
  }

  async syncUserStats(data: UserCloudSyncData): Promise<{
    success: boolean;
    syncedWorkoutIds: string[];
  }> {
    if (!this.isConfigured()) {
      return { success: false, syncedWorkoutIds: [] };
    }

    const trimmedName = data.fullName.trim();
    if (!data.userId || !trimmedName) {
      return { success: false, syncedWorkoutIds: [] };
    }

    try {
      await this.ensureFreshSession();
      const nowIso = new Date().toISOString();
      const userPayload: SupabaseLeaderboardRow = {
        id: data.userId,
        full_name: trimmedName,
        user_tag: data.userTag || '0000',
        email: data.email ? data.email.trim().toLowerCase() : null,
        auth_provider: data.authProvider || 'device',
        auth_user_id: data.authUserId || this.authSession?.authUserId || null,
        gender: data.gender ?? null,
        age: data.age ?? null,
        gym_id: data.gymId || null,
        gym_name: data.gymName || null,
        is_partnered: Boolean(data.isPartnered),
        current_streak: data.currentStreak,
        best_streak: data.bestStreak,
        partner_streak: data.partnerStreak ?? 0,
        best_partner_streak: data.bestPartnerStreak ?? 0,
        total_gym_time_minutes: data.totalGymTimeMinutes,
        workouts_count: data.workoutsCount,
        weekly_goal: data.weeklyGoal,
        squat_pr_kg: data.squatPrKg ?? 0,
        bench_pr_kg: data.benchPrKg ?? 0,
        deadlift_pr_kg: data.deadliftPrKg ?? 0,
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
          is_partnered: Boolean(w.isPartnered),
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
        'select=id,full_name,user_tag,email,auth_provider,gender,age,gym_id,gym_name,is_partnered,current_streak,best_streak,partner_streak,best_partner_streak,total_gym_time_minutes,workouts_count,weekly_goal,squat_pr_kg,bench_pr_kg,deadlift_pr_kg,updated_at',
        `limit=${limit}`,
      ];

      if (params.category === 'global') {
        queryParts.push('is_partnered=eq.true');
      } else if (params.category === 'gym') {
        queryParts.push('is_partnered=eq.true');
        if (params.gymId) {
          queryParts.push(`gym_id=eq.${encodeURIComponent(params.gymId)}`);
        } else if (params.gymName) {
          queryParts.push(`gym_name=eq.${encodeURIComponent(params.gymName)}`);
        } else {
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
      return rows.map(mapRowToLeaderboardUser);
    } catch (error) {
      console.warn('[Supabase] Error fetching leaderboard:', error);
      return [];
    }
  }

  async searchGyms(
    query: string,
    coords?: { latitude: number; longitude: number } | null,
    limit: number = 25
  ): Promise<PartneredGym[]> {
    if (!this.isConfigured()) return [];

    try {
      const clean = query.trim().replace(/[(),*]/g, '');
      const selectCols = 'select=id,name,address,city,state,postal_code,latitude,longitude';

      const runQuery = async (extraParts: string[]): Promise<PartneredGym[]> => {
        const url = `${SUPABASE_CONFIG.url}/rest/v1/gyms?${[selectCols, ...extraParts].join('&')}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: this.getHeaders(),
        });
        if (!res.ok) return [];
        const rows: Array<{
          id: string;
          name: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          latitude: number;
          longitude: number;
        }> = await res.json();

        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          address:
            row.address ||
            [row.city, row.state, row.postal_code].filter(Boolean).join(', ') ||
            'United States',
          latitude: row.latitude,
          longitude: row.longitude,
        }));
      };

      let mapped: PartneredGym[] = [];

      if (clean.length > 0) {
        const pattern = `*${clean}*`;
        const filterPart = `or=(name.ilike.${encodeURIComponent(
          pattern
        )},address.ilike.${encodeURIComponent(pattern)},city.ilike.${encodeURIComponent(pattern)})`;

        if (coords) {
          // Search closest ~10-mile radius first (high limit) so dense metro chains like 24 Hour Fitness never get cut off
          const nearDelta = 0.15;
          mapped = await runQuery([
            filterPart,
            `latitude=gte.${(coords.latitude - nearDelta).toFixed(5)}`,
            `latitude=lte.${(coords.latitude + nearDelta).toFixed(5)}`,
            `longitude=gte.${(coords.longitude - nearDelta).toFixed(5)}`,
            `longitude=lte.${(coords.longitude + nearDelta).toFixed(5)}`,
            'limit=200',
          ]);

          if (mapped.length < 3) {
            const metroDelta = 0.5;
            const metro = await runQuery([
              filterPart,
              `latitude=gte.${(coords.latitude - metroDelta).toFixed(5)}`,
              `latitude=lte.${(coords.latitude + metroDelta).toFixed(5)}`,
              `longitude=gte.${(coords.longitude - metroDelta).toFixed(5)}`,
              `longitude=lte.${(coords.longitude + metroDelta).toFixed(5)}`,
              'limit=200',
            ]);
            const seen = new Set(mapped.map((g) => g.id));
            mapped = [...mapped, ...metro.filter((g) => !seen.has(g.id))];
          }
        }

        if (mapped.length < 3) {
          const nationwide = await runQuery([
            filterPart,
            'order=name.asc',
            `limit=${coords ? 200 : limit}`,
          ]);
          const seen = new Set(mapped.map((g) => g.id));
          mapped = [...mapped, ...nationwide.filter((g) => !seen.has(g.id))];
        }
      } else if (coords) {
        const delta = 0.35; // ~38 km bounding box
        mapped = await runQuery([
          `latitude=gte.${(coords.latitude - delta).toFixed(5)}`,
          `latitude=lte.${(coords.latitude + delta).toFixed(5)}`,
          `longitude=gte.${(coords.longitude - delta).toFixed(5)}`,
          `longitude=lte.${(coords.longitude + delta).toFixed(5)}`,
          `limit=${Math.max(limit, 50)}`,
        ]);
      } else {
        mapped = await runQuery(['order=name.asc', `limit=${limit}`]);
      }

      if (coords) {
        mapped.sort(
          (a, b) =>
            calculateDistanceMeters(coords.latitude, coords.longitude, a.latitude, a.longitude) -
            calculateDistanceMeters(coords.latitude, coords.longitude, b.latitude, b.longitude)
        );
      }

      return mapped.slice(0, limit);
    } catch (error) {
      console.warn('[Supabase] Error searching gyms:', error);
      return [];
    }
  }

  async searchUsers(
    query: string,
    currentUserId: string
  ): Promise<RemoteLeaderboardUser[]> {
    if (!this.isConfigured()) return [];
    const raw = query.trim();
    if (!raw) return [];

    try {
      const allRes = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/leaderboard_users?select=id,full_name,user_tag,email,auth_provider,gender,age,gym_id,gym_name,is_partnered,current_streak,best_streak,partner_streak,best_partner_streak,total_gym_time_minutes,workouts_count,weekly_goal,squat_pr_kg,bench_pr_kg,deadlift_pr_kg,updated_at&limit=100`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );
      if (!allRes.ok) return [];
      const rows: SupabaseLeaderboardRow[] = await allRes.json();
      const qLower = raw.toLowerCase();
      const cleanTagQuery = qLower.startsWith('#') ? qLower.slice(1) : qLower;

      return rows
        .map(mapRowToLeaderboardUser)
        .filter((u) => u.id !== currentUserId)
        .filter((u) => {
          const combined = `${u.fullName.toLowerCase()}#${u.userTag.toLowerCase()}`;
          const combinedSpaced = `${u.fullName.toLowerCase()} #${u.userTag.toLowerCase()}`;
          return (
            u.fullName.toLowerCase().includes(qLower) ||
            u.userTag.toLowerCase().includes(cleanTagQuery) ||
            combined.includes(qLower) ||
            combinedSpaced.includes(qLower)
          );
        });
    } catch (e) {
      console.warn('[Supabase] Error searching users:', e);
      return [];
    }
  }

  async fetchFriendships(currentUserId: string): Promise<FriendshipsOverview> {
    const empty: FriendshipsOverview = {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    };
    if (!this.isConfigured() || !currentUserId) {
      return empty;
    }

    try {
      const reqUrl = `${SUPABASE_CONFIG.url}/rest/v1/friend_requests?or=(requester_id.eq.${encodeURIComponent(
        currentUserId
      )},receiver_id.eq.${encodeURIComponent(currentUserId)})&order=created_at.desc`;
      const reqRes = await fetch(reqUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!reqRes.ok) return empty;

      const requests: SupabaseFriendRequestRow[] = await reqRes.json();
      if (requests.length === 0) return empty;

      const otherUserIds = Array.from(
        new Set(
          requests.map((r) =>
            r.requester_id === currentUserId ? r.receiver_id : r.requester_id
          )
        )
      );

      if (otherUserIds.length === 0) return empty;

      const inList = otherUserIds.map((id) => `"${id}"`).join(',');
      const usersUrl = `${SUPABASE_CONFIG.url}/rest/v1/leaderboard_users?id=in.(${encodeURIComponent(
        inList
      )})`;
      const usersRes = await fetch(usersUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!usersRes.ok) return empty;

      const userRows: SupabaseLeaderboardRow[] = await usersRes.json();
      const userMap = new Map<string, RemoteLeaderboardUser>();
      for (const row of userRows) {
        userMap.set(row.id, mapRowToLeaderboardUser(row));
      }

      const friends: RemoteLeaderboardUser[] = [];
      const seenFriendIds = new Set<string>();
      const incomingRequests: FriendRequestWithUser[] = [];
      const outgoingRequests: FriendRequestWithUser[] = [];

      for (const req of requests) {
        const otherId =
          req.requester_id === currentUserId ? req.receiver_id : req.requester_id;
        const otherUser = userMap.get(otherId);
        if (!otherUser) continue;

        if (req.status === 'accepted') {
          if (!seenFriendIds.has(otherId)) {
            seenFriendIds.add(otherId);
            friends.push(otherUser);
          }
        } else if (req.status === 'pending') {
          const item: FriendRequestWithUser = {
            requestId: req.id,
            requesterId: req.requester_id,
            receiverId: req.receiver_id,
            status: req.status,
            createdAt: req.created_at,
            user: otherUser,
          };
          if (req.receiver_id === currentUserId) {
            incomingRequests.push(item);
          } else {
            outgoingRequests.push(item);
          }
        }
      }

      return {
        friends,
        incomingRequests,
        outgoingRequests,
      };
    } catch (error) {
      console.warn('[Supabase] Error fetching friendships:', error);
      return empty;
    }
  }

  async sendFriendRequest(
    requesterId: string,
    receiverId: string
  ): Promise<{ success: boolean; autoAccepted?: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Cloud database not configured.' };
    }
    if (!requesterId || !receiverId || requesterId === receiverId) {
      return { success: false, message: 'Invalid friend request.' };
    }

    try {
      // Check if an existing request in either direction already exists
      const existingUrl = `${SUPABASE_CONFIG.url}/rest/v1/friend_requests?or=(and(requester_id.eq.${encodeURIComponent(
        requesterId
      )},receiver_id.eq.${encodeURIComponent(
        receiverId
      )}),and(requester_id.eq.${encodeURIComponent(
        receiverId
      )},receiver_id.eq.${encodeURIComponent(requesterId)}))`;

      const existingRes = await fetch(existingUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (existingRes.ok) {
        const existingRows: SupabaseFriendRequestRow[] = await existingRes.json();
        const alreadyAccepted = existingRows.find((r) => r.status === 'accepted');
        if (alreadyAccepted) {
          return { success: true, autoAccepted: true, message: 'You are already friends!' };
        }

        // If the other user already sent a pending request to us, auto-accept it!
        const incomingPending = existingRows.find(
          (r) => r.requester_id === receiverId && r.receiver_id === requesterId && r.status === 'pending'
        );
        if (incomingPending) {
          const ok = await this.respondToFriendRequest(incomingPending.id, true);
          return {
            success: ok,
            autoAccepted: ok,
            message: ok
              ? 'Mutual friend request accepted!'
              : 'Could not accept friend request.',
          };
        }

        const outgoingPending = existingRows.find(
          (r) => r.requester_id === requesterId && r.receiver_id === receiverId && r.status === 'pending'
        );
        if (outgoingPending) {
          return { success: true, message: 'Friend request already sent and pending.' };
        }
      }

      const nowIso = new Date().toISOString();
      const payload: SupabaseFriendRequestRow = {
        id: `freq_${requesterId}_${receiverId}`,
        requester_id: requesterId,
        receiver_id: receiverId,
        status: 'pending',
        created_at: nowIso,
        updated_at: nowIso,
      };

      const res = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/friend_requests?on_conflict=requester_id,receiver_id`,
        {
          method: 'POST',
          headers: this.getHeaders({
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.warn('[Supabase] Failed to send friend request:', errText);
        return { success: false, message: 'Failed to send friend request.' };
      }

      return { success: true, message: 'Friend request sent!' };
    } catch (error) {
      console.warn('[Supabase] Error sending friend request:', error);
      return { success: false, message: 'Network error sending friend request.' };
    }
  }

  async respondToFriendRequest(requestId: string, accept: boolean): Promise<boolean> {
    if (!this.isConfigured() || !requestId) return false;

    try {
      if (accept) {
        const res = await fetch(
          `${SUPABASE_CONFIG.url}/rest/v1/friend_requests?id=eq.${encodeURIComponent(requestId)}`,
          {
            method: 'PATCH',
            headers: this.getHeaders({
              Prefer: 'return=minimal',
            }),
            body: JSON.stringify({
              status: 'accepted',
              updated_at: new Date().toISOString(),
            }),
          }
        );
        return res.ok;
      } else {
        // Delete declined request so either user can send a fresh request in the future
        const res = await fetch(
          `${SUPABASE_CONFIG.url}/rest/v1/friend_requests?id=eq.${encodeURIComponent(requestId)}`,
          {
            method: 'DELETE',
            headers: this.getHeaders(),
          }
        );
        return res.ok;
      }
    } catch (error) {
      console.warn('[Supabase] Error responding to friend request:', error);
      return false;
    }
  }

  async submitGymReport(input: GymReportInput): Promise<boolean> {
    if (!this.isConfigured() || !input.gymName.trim()) return false;

    try {
      await this.ensureFreshSession();
      const payload = {
        id: `grep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        reporter_user_id: input.reporterUserId || null,
        auth_user_id: this.authSession?.authUserId || null,
        gym_id: input.gymId || null,
        gym_name: input.gymName.trim(),
        report_type: input.reportType,
        suggested_address: input.suggestedAddress?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        notes: input.notes?.trim() || null,
        status: 'pending',
      };

      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/gym_reports`, {
        method: 'POST',
        headers: this.getHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (error) {
      console.warn('[Supabase] Failed to submit gym report:', error);
      return false;
    }
  }

  async deleteUserAccount(userId: string): Promise<boolean> {
    if (!this.isConfigured() || !userId) return false;

    try {
      await this.ensureFreshSession();
      // Remove any friend requests involving this user
      await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/friend_requests?or=(requester_id.eq.${encodeURIComponent(
          userId
        )},receiver_id.eq.${encodeURIComponent(userId)})`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
        }
      );

      // Delete the user's leaderboard_users row (cascades to user_workouts)
      const res = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/leaderboard_users?id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
        }
      );
      return res.ok;
    } catch (error) {
      console.warn('[Supabase] Error deleting user account:', error);
      return false;
    }
  }
}
