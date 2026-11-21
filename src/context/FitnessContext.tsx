import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { VERIFIED_GYMS, VerifiedGym } from '../constants/verifiedGyms';
import {
  UserProfile,
  UserPreferences,
  WorkoutSession,
  StreakState,
  GymLocation,
  DwellSessionState,
  AuthProviderType,
  WeightUnit,
  UserGender,
  ThemeMode,
  DistanceUnit,
  FontSizeMode,
  FIXED_DWELL_MINUTES,
  MAX_MANUAL_SESSION_MINUTES,
  DEFAULT_GEOFENCE_RADIUS_METERS,
  MIN_GEOFENCE_RADIUS_METERS,
} from '../types/fitness';
import { AppTheme, getTheme } from '../constants/theme';
import {
  storageService,
  createDefaultUserProfile,
  generateUserTag,
  DEFAULT_PREFERENCES,
  DEFAULT_STREAK_STATE,
  DEFAULT_DWELL_SESSION,
} from '../services/storageService';
import {
  evaluateWeeklyReset,
} from '../services/streakManager';
import {
  calculateDistanceMeters,
  getCurrentCoordinates,
  getLocationPermissionStatus,
  requestLocationPermissions,
  setupGymGeofence,
  stopGymGeofence,
  subscribeToLocationUpdates,
} from '../services/locationService';
import {
  BugReportInput,
  cloudDatabase,
  FriendshipsOverview,
  GymReportInput,
  RemoteLeaderboardUser,
} from '../services/cloud';
import { formatDateToYYYYMMDD, getIsoWeekId } from '../utils/dateUtils';
import { triggerLightHaptic, triggerSuccessHaptic, setHapticsEnabled as applyHapticsEnabled } from '../utils/haptics';

export interface SignInAccountInput {
  fullName: string;
  email?: string;
  authProvider: AuthProviderType;
  authUserId?: string | null;
}

interface FitnessContextType {
  userProfile: UserProfile;
  preferences: UserPreferences;
  streakState: StreakState;
  workouts: WorkoutSession[];
  dwellState: DwellSessionState;
  currentDistanceMeters: number | null;
  permissionStatus: { foregroundGranted: boolean; backgroundGranted: boolean };
  isLoading: boolean;
  isCloudConfigured: boolean;
  isSyncingCloud: boolean;
  friendships: FriendshipsOverview;
  updateUserProfile: (
    fullName: string,
    options?: {
      email?: string;
      authProvider?: AuthProviderType;
      gender?: UserGender;
      age?: number | null;
    }
  ) => Promise<void>;
  updateLiftPrs: (updates: {
    squatPrKg?: number;
    benchPrKg?: number;
    deadliftPrKg?: number;
    preferredWeightUnit?: WeightUnit;
  }) => Promise<void>;
  setPreferredWeightUnit: (unit: WeightUnit) => Promise<void>;
  signInWithAccount: (input: SignInAccountInput) => Promise<{ restoredExisting: boolean }>;
  handleOAuthRedirectUrl: (url: string) => Promise<boolean>;
  signOutAccount: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  setWeeklyGoal: (goal: number) => Promise<void>;
  scheduleGoalForMonday: (goal: number) => Promise<void>;
  cancelPendingGoal: () => Promise<void>;
  updateGymLocation: (location: GymLocation) => Promise<void>;
  setAutoDetectGym: (enabled: boolean) => Promise<void>;
  setGeofenceRadiusMeters: (radiusMeters: number) => Promise<void>;
  themeMode: ThemeMode;
  theme: AppTheme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  distanceUnit: DistanceUnit;
  setDistanceUnit: (unit: DistanceUnit) => Promise<void>;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
  fontSizeMode: FontSizeMode;
  fontScale: number;
  setFontSizeMode: (mode: FontSizeMode) => Promise<void>;
  isTabSwipeLocked: boolean;
  isTabSwipeLockedRef: React.MutableRefObject<boolean>;
  setTabSwipeLocked: (locked: boolean) => void;
  refreshLocation: () => Promise<void>;
  refreshPermissionStatus: () => Promise<{ foregroundGranted: boolean; backgroundGranted: boolean }>;
  requestAutoTrackingPermission: () => Promise<{ foregroundGranted: boolean; backgroundGranted: boolean }>;
  startManualGymSession: () => Promise<{ success: boolean; message: string }>;
  endManualGymSession: () => Promise<void>;
  syncToCloud: () => Promise<void>;
  fetchLeaderboardEntries: (
    category: 'global' | 'gym' | 'friends'
  ) => Promise<RemoteLeaderboardUser[]>;
  searchExistingGyms: (
    query: string,
    coords?: { latitude: number; longitude: number } | null
  ) => Promise<VerifiedGym[]>;
  submitGymReport: (input: GymReportInput) => Promise<boolean>;
  submitBugReport: (input: BugReportInput) => Promise<boolean>;
  refreshFriendships: () => Promise<FriendshipsOverview>;
  searchUsersForFriend: (query: string) => Promise<RemoteLeaderboardUser[]>;
  sendFriendRequestToUser: (
    receiverId: string
  ) => Promise<{ success: boolean; autoAccepted?: boolean; message: string }>;
  respondToFriendRequest: (requestId: string, accept: boolean) => Promise<boolean>;
  simulateEnterGym: () => void;
  simulateDwellProgress: (minutes: number) => void;
  simulateLeaveGym: () => void;
  testSimulatePreviousWeek: (workoutsInPriorWeek: number) => Promise<void>;
  resetAll: () => Promise<void>;
}

const FitnessContext = createContext<FitnessContextType | undefined>(undefined);

export const FitnessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile>(createDefaultUserProfile);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [streakState, setStreakState] = useState<StreakState>(DEFAULT_STREAK_STATE);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [currentDistanceMeters, setCurrentDistanceMeters] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<{
    foregroundGranted: boolean;
    backgroundGranted: boolean;
  }>({ foregroundGranted: false, backgroundGranted: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [friendships, setFriendships] = useState<FriendshipsOverview>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  });

  const [dwellState, setDwellState] = useState<DwellSessionState>(DEFAULT_DWELL_SESSION);

  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;

  const streakStateRef = useRef(streakState);
  streakStateRef.current = streakState;

  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;

  const syncSnapshotToCloud = useCallback(
    async (
      profileSnap: UserProfile,
      prefsSnap: UserPreferences,
      streakSnap: StreakState,
      workoutsSnap: WorkoutSession[]
    ) => {
      if (!cloudDatabase.isConfigured() || !profileSnap.fullName.trim()) {
        return;
      }

      setIsSyncingCloud(true);
      try {
        const totalGymTimeMinutes = workoutsSnap.reduce(
          (sum, w) => sum + (w.durationMinutes || 0),
          0
        );
        const unsyncedWorkouts = workoutsSnap.filter((w) => !w.synced);

        const result = await cloudDatabase.syncUserStats({
          userId: profileSnap.id,
          fullName: profileSnap.fullName,
          userTag: profileSnap.userTag || generateUserTag(profileSnap.id),
          email: profileSnap.email ?? null,
          authProvider: profileSnap.authProvider || 'device',
          authUserId: profileSnap.authUserId ?? null,
          gender: profileSnap.gender ?? null,
          age: profileSnap.age ?? null,
          gymId: prefsSnap.gymLocation?.id || null,
          gymName: prefsSnap.gymLocation?.name || null,
          isVerified: Boolean(prefsSnap.gymLocation?.isVerified),
          currentStreak: streakSnap.currentStreak,
          bestStreak: streakSnap.bestStreak,
          verifiedStreak: streakSnap.verifiedStreak ?? 0,
          bestVerifiedStreak: streakSnap.bestVerifiedStreak ?? 0,
          totalGymTimeMinutes,
          workoutsCount: workoutsSnap.length,
          weeklyGoal: prefsSnap.weeklyGoal,
          squatPrKg: profileSnap.squatPrKg ?? 0,
          benchPrKg: profileSnap.benchPrKg ?? 0,
          deadliftPrKg: profileSnap.deadliftPrKg ?? 0,
          unsyncedWorkouts,
        });

        if (result.success) {
          const syncedAt = new Date().toISOString();
          const updatedProfile: UserProfile = {
            ...profileSnap,
            syncedAt,
          };
          await storageService.saveUserProfile(updatedProfile);
          setUserProfile(updatedProfile);

          if (result.syncedWorkoutIds.length > 0) {
            const syncedSet = new Set(result.syncedWorkoutIds);
            const markedWorkouts = workoutsSnap.map((w) =>
              syncedSet.has(w.id) ? { ...w, synced: true } : w
            );
            await storageService.saveWorkouts(markedWorkouts);
            setWorkouts(markedWorkouts);
          }
        }
      } catch (e) {
        console.warn('Cloud sync failed:', e);
      } finally {
        setIsSyncingCloud(false);
      }
    },
    []
  );

  const syncToCloud = useCallback(async () => {
    await syncSnapshotToCloud(
      userProfileRef.current,
      preferencesRef.current,
      streakStateRef.current,
      workoutsRef.current
    );
  }, [syncSnapshotToCloud]);

  const fetchLeaderboardEntries = useCallback(
    async (category: 'global' | 'gym' | 'friends'): Promise<RemoteLeaderboardUser[]> => {
      const gym = preferencesRef.current.gymLocation;
      if (category === 'friends') {
        const overview = await cloudDatabase.fetchFriendships(userProfileRef.current.id);
        setFriendships(overview);
        return overview.friends;
      }
      return cloudDatabase.fetchLeaderboard({
        category,
        gymId: gym?.id || null,
        gymName: gym?.name || null,
      });
    },
    []
  );

  const searchExistingGyms = useCallback(
    async (
      query: string,
      coords?: { latitude: number; longitude: number } | null
    ): Promise<VerifiedGym[]> => {
      const q = query.trim().toLowerCase();
      if (!q && !coords) {
        return [];
      }

      const localMatches = VERIFIED_GYMS.filter(
        (g) =>
          !q ||
          g.name.toLowerCase().includes(q) ||
          g.address.toLowerCase().includes(q)
      );

      let combined = localMatches;
      if (cloudDatabase.isConfigured()) {
        const remote = await cloudDatabase.searchGyms(query, coords, 25);
        if (remote.length > 0) {
          const seen = new Set(remote.map((g) => g.id));
          combined = [...remote, ...localMatches.filter((g) => !seen.has(g.id))];
        }
      }

      if (coords) {
        combined = [...combined].sort(
          (a, b) =>
            calculateDistanceMeters(coords.latitude, coords.longitude, a.latitude, a.longitude) -
            calculateDistanceMeters(coords.latitude, coords.longitude, b.latitude, b.longitude)
        );
      }

      return combined;
    },
    []
  );

  const submitGymReport = useCallback(async (input: GymReportInput): Promise<boolean> => {
    return cloudDatabase.submitGymReport({
      ...input,
      reporterUserId: userProfileRef.current.id,
    });
  }, []);

  const submitBugReport = useCallback(async (input: BugReportInput): Promise<boolean> => {
    return cloudDatabase.submitBugReport({
      ...input,
      reporterUserId: userProfileRef.current.id,
    });
  }, []);

  const refreshFriendships = useCallback(async (): Promise<FriendshipsOverview> => {
    const overview = await cloudDatabase.fetchFriendships(userProfileRef.current.id);
    setFriendships(overview);
    return overview;
  }, []);

  const searchUsersForFriend = useCallback(
    async (query: string): Promise<RemoteLeaderboardUser[]> => {
      return cloudDatabase.searchUsers(query, userProfileRef.current.id);
    },
    []
  );

  const sendFriendRequestToUser = useCallback(
    async (receiverId: string) => {
      const res = await cloudDatabase.sendFriendRequest(
        userProfileRef.current.id,
        receiverId
      );
      if (res.success) {
        await refreshFriendships();
      }
      return res;
    },
    [refreshFriendships]
  );

  const respondToFriendRequest = useCallback(
    async (requestId: string, accept: boolean): Promise<boolean> => {
      const ok = await cloudDatabase.respondToFriendRequest(requestId, accept);
      if (ok) {
        await refreshFriendships();
      }
      return ok;
    },
    [refreshFriendships]
  );

  // Load state, profile, persisted dwell session, and perform weekly evaluation
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [savedProfile, savedPrefs, savedWorkouts, savedStreak, savedAuthSession] =
        await Promise.all([
          storageService.getUserProfile(),
          storageService.getPreferences(),
          storageService.getWorkouts(),
          storageService.getStreakState(),
          storageService.getAuthSession(),
        ]);

      let activeProfile = savedProfile;
      if (savedAuthSession) {
        cloudDatabase.setAuthSession(savedAuthSession);
        if (
          savedAuthSession.expiresAt &&
          savedAuthSession.refreshToken &&
          Date.now() > savedAuthSession.expiresAt - 60_000
        ) {
          const refreshed = await cloudDatabase.refreshAuthSession(savedAuthSession.refreshToken);
          if (refreshed) {
            await storageService.saveAuthSession(refreshed);
          }
        }
      } else if (cloudDatabase.isConfigured() && savedProfile.authProvider !== 'google') {
        const anonSession = await cloudDatabase.signInAnonymously();
        if (anonSession) {
          await storageService.saveAuthSession(anonSession);
          if (!activeProfile.authUserId && anonSession.authUserId) {
            activeProfile = await storageService.saveUserProfile({
              ...activeProfile,
              authUserId: anonSession.authUserId,
            });
          }
        }
      }

      // Ensure defaults & locked values
      const resolvedRadius = Math.min(
        DEFAULT_GEOFENCE_RADIUS_METERS,
        Math.max(
          MIN_GEOFENCE_RADIUS_METERS,
          savedPrefs.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS
        )
      );
      savedPrefs.geofenceRadiusMeters = resolvedRadius;
      savedPrefs.themeMode = savedPrefs.themeMode || 'dark';
      savedPrefs.hapticsEnabled = savedPrefs.hapticsEnabled !== false;
      applyHapticsEnabled(savedPrefs.hapticsEnabled);
      savedPrefs.dwellDurationMinutes = FIXED_DWELL_MINUTES;
      if (savedPrefs.gymLocation) {
        savedPrefs.gymLocation.dwellMinutesRequired = FIXED_DWELL_MINUTES;
        savedPrefs.gymLocation.radiusMeters = resolvedRadius;
      }

      const currentWeekId = getIsoWeekId(new Date());

      // If week transitioned to a new week, apply any scheduled Monday goal change
      if (savedStreak.lastEvaluatedWeekId && savedStreak.lastEvaluatedWeekId !== currentWeekId) {
        if (savedPrefs.pendingWeeklyGoal) {
          savedPrefs.weeklyGoal = savedPrefs.pendingWeeklyGoal;
          savedPrefs.pendingWeeklyGoal = null;
          await storageService.savePreferences(savedPrefs);
        }
      }

      // Attach userId to streakState if missing
      if (!savedStreak.userId) {
        savedStreak.userId = savedProfile.id;
      }

      // Check weekly reset
      const evaluatedStreak = evaluateWeeklyReset(
        savedStreak,
        savedPrefs,
        savedWorkouts,
        new Date(),
        activeProfile.createdAt
      );
      await storageService.saveStreakState(evaluatedStreak);

      // Evaluate any persisted background dwell session
      const dwellEval = await storageService.evaluatePersistedDwellSession();

      setUserProfile(activeProfile);
      setPreferences(savedPrefs);
      setWorkouts(dwellEval.workouts);
      setStreakState(dwellEval.streakState);
      setDwellState(dwellEval.dwellSession);

      const perms = await getLocationPermissionStatus();
      setPermissionStatus(perms);
      if (savedPrefs.gymLocation && !savedPrefs.gymLocation.isManual && savedPrefs.autoDetectGym && perms.backgroundGranted) {
        setupGymGeofence(savedPrefs.gymLocation);
      }

      // Push latest stats to cloud database & load friendships in background
      syncSnapshotToCloud(
        activeProfile,
        savedPrefs,
        dwellEval.streakState,
        dwellEval.workouts
      );
      cloudDatabase.fetchFriendships(activeProfile.id).then((overview) => {
        setFriendships(overview);
      });
    } catch (e) {
      console.error('Failed to load initial fitness data', e);
    } finally {
      setIsLoading(false);
    }
  }, [syncSnapshotToCloud]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save user's Full Name locally on device & sync to cloud
  const updateUserProfile = async (
    fullName: string,
    options?: {
      email?: string;
      authProvider?: AuthProviderType;
      gender?: UserGender;
      age?: number | null;
    }
  ) => {
    const trimmed = fullName.trim();
    const updatedProfile: UserProfile = {
      ...userProfile,
      fullName: trimmed,
      userTag: userProfile.userTag || generateUserTag(userProfile.id),
      email: options?.email !== undefined ? options.email.trim().toLowerCase() || null : userProfile.email,
      authProvider: options?.authProvider || userProfile.authProvider || 'device',
      gender: options?.gender !== undefined ? options.gender : userProfile.gender ?? null,
      age: options?.age !== undefined ? options.age : userProfile.age ?? null,
      hasCompletedOnboarding: Boolean(trimmed),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storageService.saveUserProfile(updatedProfile);
    setUserProfile(saved);
    await syncSnapshotToCloud(saved, preferences, streakState, workouts);
  };

  const updateLiftPrs = async (updates: {
    squatPrKg?: number;
    benchPrKg?: number;
    deadliftPrKg?: number;
    preferredWeightUnit?: WeightUnit;
  }) => {
    const updatedProfile: UserProfile = {
      ...userProfileRef.current,
      squatPrKg:
        updates.squatPrKg !== undefined
          ? Math.max(0, updates.squatPrKg)
          : userProfileRef.current.squatPrKg ?? 0,
      benchPrKg:
        updates.benchPrKg !== undefined
          ? Math.max(0, updates.benchPrKg)
          : userProfileRef.current.benchPrKg ?? 0,
      deadliftPrKg:
        updates.deadliftPrKg !== undefined
          ? Math.max(0, updates.deadliftPrKg)
          : userProfileRef.current.deadliftPrKg ?? 0,
      preferredWeightUnit:
        updates.preferredWeightUnit ||
        userProfileRef.current.preferredWeightUnit ||
        'lbs',
      updatedAt: new Date().toISOString(),
    };

    const saved = await storageService.saveUserProfile(updatedProfile);
    setUserProfile(saved);
    await syncSnapshotToCloud(
      saved,
      preferencesRef.current,
      streakStateRef.current,
      workoutsRef.current
    );
  };

  const setPreferredWeightUnit = async (unit: WeightUnit) => {
    const updatedProfile: UserProfile = {
      ...userProfileRef.current,
      preferredWeightUnit: unit,
      updatedAt: new Date().toISOString(),
    };
    const saved = await storageService.saveUserProfile(updatedProfile);
    setUserProfile(saved);
  };

  /**
   * One-time sign-in with Google, Apple, or quick profile setup.
   * Deduplicates accounts by checking if an existing cloud account matches the email.
   */
  const signInWithAccount = async (
    input: SignInAccountInput
  ): Promise<{ restoredExisting: boolean }> => {
    const cleanEmail = input.email?.trim().toLowerCase() || '';
    const trimmedName = input.fullName.trim();
    let resolvedAuthUserId = input.authUserId ?? userProfile.authUserId ?? null;

    if (input.authProvider === 'device' && !resolvedAuthUserId && cloudDatabase.isConfigured()) {
      const existingSession = await storageService.getAuthSession();
      if (existingSession?.authUserId) {
        cloudDatabase.setAuthSession(existingSession);
        resolvedAuthUserId = existingSession.authUserId;
      } else {
        const anonSession = await cloudDatabase.signInAnonymously();
        if (anonSession) {
          await storageService.saveAuthSession(anonSession);
          resolvedAuthUserId = anonSession.authUserId || null;
        }
      }
    }

    if (cleanEmail && cloudDatabase.isConfigured()) {
      const existingRemote = await cloudDatabase.findExistingUserByEmail(cleanEmail);
      if (existingRemote) {
        const restoredProfile: UserProfile = {
          ...userProfile,
          id: existingRemote.id,
          fullName: trimmedName || existingRemote.fullName,
          userTag: existingRemote.userTag,
          email: cleanEmail,
          authProvider: input.authProvider,
          authUserId: resolvedAuthUserId,
          gender: existingRemote.gender ?? userProfile.gender ?? null,
          age: existingRemote.age ?? userProfile.age ?? null,
          squatPrKg: existingRemote.squatPrKg ?? userProfile.squatPrKg ?? 0,
          benchPrKg: existingRemote.benchPrKg ?? userProfile.benchPrKg ?? 0,
          deadliftPrKg: existingRemote.deadliftPrKg ?? userProfile.deadliftPrKg ?? 0,
          hasCompletedOnboarding: true,
          updatedAt: new Date().toISOString(),
        };

        const restoredStreak: StreakState = {
          ...streakState,
          userId: existingRemote.id,
          currentStreak: Math.max(streakState.currentStreak, existingRemote.currentStreak),
          bestStreak: Math.max(streakState.bestStreak, existingRemote.bestStreak),
          verifiedStreak: Math.max(streakState.verifiedStreak ?? 0, existingRemote.verifiedStreak ?? 0),
          bestVerifiedStreak: Math.max(
            streakState.bestVerifiedStreak ?? 0,
            existingRemote.bestVerifiedStreak ?? 0
          ),
        };

        await Promise.all([
          storageService.saveUserProfile(restoredProfile),
          storageService.saveStreakState(restoredStreak),
        ]);

        setUserProfile(restoredProfile);
        setStreakState(restoredStreak);

        await syncSnapshotToCloud(restoredProfile, preferences, restoredStreak, workouts);
        const overview = await cloudDatabase.fetchFriendships(restoredProfile.id);
        setFriendships(overview);

        return { restoredExisting: true };
      }
    }

    const newProfile: UserProfile = {
      ...userProfile,
      fullName: trimmedName,
      userTag: userProfile.userTag || generateUserTag(userProfile.id),
      email: cleanEmail || null,
      authProvider: input.authProvider,
      authUserId: resolvedAuthUserId,
      hasCompletedOnboarding: Boolean(trimmedName),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storageService.saveUserProfile(newProfile);
    setUserProfile(saved);
    await syncSnapshotToCloud(saved, preferences, streakState, workouts);
    const overview = await cloudDatabase.fetchFriendships(saved.id);
    setFriendships(overview);

    return { restoredExisting: false };
  };

  const signOutAccount = async () => {
    cloudDatabase.setAuthSession(null);
    await storageService.clearAuthSession();
    const signedOutProfile: UserProfile = {
      ...userProfile,
      hasCompletedOnboarding: false,
      updatedAt: new Date().toISOString(),
    };
    const saved = await storageService.saveUserProfile(signedOutProfile);
    setUserProfile(saved);
  };

  const handleOAuthRedirectUrl = useCallback(
    async (url: string): Promise<boolean> => {
      if (!url) return false;

      // Check for OAuth error in query or hash
      const errorMatch = url.match(/[?#&]error_description=([^&]+)/);
      if (errorMatch && errorMatch[1]) {
        const decodedErr = decodeURIComponent(errorMatch[1].replace(/\+/g, ' '));
        Alert.alert('Sign-In Error', decodedErr);
        return false;
      }

      const tokenMatch = url.match(/[?#&]access_token=([^&]+)/);
      if (!tokenMatch || !tokenMatch[1]) {
        return false;
      }

      const accessToken = decodeURIComponent(tokenMatch[1]);
      const refreshMatch = url.match(/[?#&]refresh_token=([^&]+)/);
      const expiresMatch = url.match(/[?#&]expires_in=([^&]+)/);
      const refreshToken = refreshMatch?.[1] ? decodeURIComponent(refreshMatch[1]) : undefined;
      const expiresInSec = expiresMatch?.[1] ? Number(decodeURIComponent(expiresMatch[1])) : undefined;

      const identity = await cloudDatabase.getUserFromAccessToken(accessToken, 'google');
      if (!identity) {
        Alert.alert('Sign-In Error', 'Could not retrieve your Google/Apple profile from token.');
        return false;
      }

      const authSession = {
        accessToken,
        refreshToken,
        expiresAt: expiresInSec ? Date.now() + expiresInSec * 1000 : undefined,
        authUserId: identity.authUserId,
      };
      cloudDatabase.setAuthSession(authSession);
      await storageService.saveAuthSession(authSession);

      await signInWithAccount({
        fullName: identity.fullName,
        email: identity.email,
        authProvider: identity.provider,
        authUserId: identity.authUserId,
      });
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userProfile, preferences, streakState, workouts]
  );

  // Global listener for OAuth deep-link redirects
  useEffect(() => {
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && initialUrl.includes('access_token=')) {
        handleOAuthRedirectUrl(initialUrl);
      }
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url && (url.includes('access_token=') || url.includes('error_description='))) {
        handleOAuthRedirectUrl(url);
      }
    });

    return () => {
      sub.remove();
    };
  }, [handleOAuthRedirectUrl]);

  // Helper to apply GPS proximity check and persist dwell state to AsyncStorage
  const applyProximityDistance = useCallback(async (distance: number, gym: GymLocation) => {
    if (gym.isManual) return;
    setCurrentDistanceMeters(distance);
    const radius = gym.radiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;

    if (distance <= radius) {
      if (!preferencesRef.current.autoDetectGym) {
        return;
      }
      await storageService.handleBackgroundGeofenceEnter(gym.name);
      const evalResult = await storageService.evaluatePersistedDwellSession();
      setDwellState(evalResult.dwellSession);
      setStreakState(evalResult.streakState);
      setWorkouts(evalResult.workouts);
      if (evalResult.completedNow) {
        triggerSuccessHaptic();
        syncSnapshotToCloud(
          userProfileRef.current,
          preferencesRef.current,
          evalResult.streakState,
          evalResult.workouts
        );
      }
    } else {
      const wasDwelling = dwellState.isDwelling;
      const exitedSession = await storageService.handleBackgroundGeofenceExit();
      const [latestStreak, latestWorkouts] = await Promise.all([
        storageService.getStreakState(),
        storageService.getWorkouts(),
      ]);
      setDwellState(exitedSession);
      setStreakState(latestStreak);
      setWorkouts(latestWorkouts);
      if (wasDwelling && exitedSession.completedToday) {
        syncSnapshotToCloud(
          userProfileRef.current,
          preferencesRef.current,
          latestStreak,
          latestWorkouts
        );
      }
    }
  }, [dwellState.isDwelling, syncSnapshotToCloud]);

  // Check current GPS location against gym
  const refreshLocation = useCallback(async () => {
    const gym = preferencesRef.current.gymLocation;
    if (!gym || gym.isManual) return;
    const coords = await getCurrentCoordinates();
    if (!coords) return;

    const distance = calculateDistanceMeters(
      coords.latitude,
      coords.longitude,
      gym.latitude,
      gym.longitude
    );
    await applyProximityDistance(distance, gym);
  }, [applyProximityDistance]);

  // Listen to AppState so when user unlocks phone, returns from Settings, or reopens app, permissions & dwell state sync immediately
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const [evalResult, perms] = await Promise.all([
          storageService.evaluatePersistedDwellSession(),
          getLocationPermissionStatus(),
        ]);
        setDwellState(evalResult.dwellSession);
        setStreakState(evalResult.streakState);
        setWorkouts(evalResult.workouts);
        setPermissionStatus(perms);
        if (
          preferencesRef.current.gymLocation &&
          preferencesRef.current.autoDetectGym &&
          perms.backgroundGranted
        ) {
          setupGymGeofence(preferencesRef.current.gymLocation);
        }
        refreshLocation();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshLocation]);

  // Continuous live GPS watching when app is active
  useEffect(() => {
    let sub: any = null;
    let isMounted = true;

    refreshLocation();

    if (preferences.gymLocation && !preferences.gymLocation.isManual) {
      subscribeToLocationUpdates((coords) => {
        if (!isMounted) return;
        const gym = preferencesRef.current.gymLocation;
        if (!gym) return;

        const distance = calculateDistanceMeters(
          coords.latitude,
          coords.longitude,
          gym.latitude,
          gym.longitude
        );
        applyProximityDistance(distance, gym);
      }).then((subscription) => {
        if (isMounted) {
          sub = subscription;
        } else if (subscription && subscription.remove) {
          subscription.remove();
        }
      });
    }

    return () => {
      isMounted = false;
      if (sub && sub.remove) sub.remove();
    };
  }, [preferences.gymLocation, refreshLocation, applyProximityDistance]);

  // Live real-time dwell time counter — continues tracking past 15 minutes for as long as user remains at the gym!
  useEffect(() => {
    if (!dwellState.isDwelling || !dwellState.enteredAt) {
      return;
    }

    const interval = setInterval(async () => {
      const evalResult = await storageService.evaluatePersistedDwellSession();
      setDwellState(evalResult.dwellSession);
      setStreakState(evalResult.streakState);
      setWorkouts(evalResult.workouts);
      if (evalResult.completedNow) {
        triggerSuccessHaptic();
        syncSnapshotToCloud(
          userProfileRef.current,
          preferencesRef.current,
          evalResult.streakState,
          evalResult.workouts
        );
      }
    }, 5000); // Ticks every 5 seconds

    return () => clearInterval(interval);
  }, [dwellState.isDwelling, dwellState.enteredAt, syncSnapshotToCloud]);

  // Update weekly goal immediately (e.g. on Monday)
  const setWeeklyGoal = async (goal: number) => {
    const updatedPrefs: UserPreferences = {
      ...preferences,
      weeklyGoal: goal,
      pendingWeeklyGoal: null,
      dwellDurationMinutes: FIXED_DWELL_MINUTES,
    };
    if (updatedPrefs.gymLocation) {
      updatedPrefs.gymLocation.dwellMinutesRequired = FIXED_DWELL_MINUTES;
      updatedPrefs.gymLocation.radiusMeters =
        preferences.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS;
    }

    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);

    const reEvaluated = evaluateWeeklyReset(streakState, updatedPrefs, workouts, new Date());
    setStreakState(reEvaluated);
    await storageService.saveStreakState(reEvaluated);
    await syncSnapshotToCloud(userProfile, updatedPrefs, reEvaluated, workouts);
  };

  // Schedule weekly goal to update starting next Monday
  const scheduleGoalForMonday = async (goal: number) => {
    const updatedPrefs: UserPreferences = {
      ...preferences,
      pendingWeeklyGoal: goal,
    };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
  };

  // Cancel scheduled Monday goal
  const cancelPendingGoal = async () => {
    const updatedPrefs: UserPreferences = {
      ...preferences,
      pendingWeeklyGoal: null,
    };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
  };

  // Update Gym Location with configured radius (<= 150m) and 15 min dwell
  const updateGymLocation = async (location: GymLocation) => {
    const activeRadius =
      preferences.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS;
    const lockedLocation: GymLocation = {
      ...location,
      radiusMeters: activeRadius,
      dwellMinutesRequired: FIXED_DWELL_MINUTES, // Fixed at 15m
    };

    const isChangingGym =
      preferences.gymLocation?.name !== lockedLocation.name ||
      Boolean(preferences.gymLocation?.isVerified) !== Boolean(lockedLocation.isVerified) ||
      Boolean(preferences.gymLocation?.isManual) !== Boolean(lockedLocation.isManual);

    if (lockedLocation.isManual) {
      await stopGymGeofence();
      setCurrentDistanceMeters(null);
    }

    if (isChangingGym && dwellState.isDwelling) {
      // Finalize any active dwell at the previous gym before switching preferences
      await storageService.handleBackgroundGeofenceExit();
    }

    const updatedPrefs: UserPreferences = { ...preferences, gymLocation: lockedLocation };
    preferencesRef.current = updatedPrefs;
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);

    if (isChangingGym) {
      const today = formatDateToYYYYMMDD(new Date());
      const todayWorkout = workouts.find((w) => w.dateString === today);
      const isUpgradingToVerified = Boolean(
        todayWorkout && !todayWorkout.isVerified && lockedLocation.isVerified
      );
      const resetSession: DwellSessionState = {
        isDwelling: false,
        enteredAt: undefined,
        minutesDwelling: 0,
        gymName: lockedLocation.name,
        completedToday: Boolean(todayWorkout) && !isUpgradingToVerified,
        dateString: today,
      };
      await storageService.saveDwellSession(resetSession);
      setDwellState(resetSession);
    }

    refreshLocation();
    await syncSnapshotToCloud(userProfile, updatedPrefs, streakState, workouts);
  };

  const setAutoDetectGym = useCallback(async (enabled: boolean) => {
    const updatedPrefs: UserPreferences = {
      ...preferencesRef.current,
      autoDetectGym: enabled,
    };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
    if (enabled && updatedPrefs.gymLocation && permissionStatus.backgroundGranted) {
      await setupGymGeofence(updatedPrefs.gymLocation);
    } else if (!enabled) {
      await stopGymGeofence();
    }
  }, [permissionStatus.backgroundGranted]);

  const setGeofenceRadiusMeters = useCallback(
    async (radiusMeters: number) => {
      const clamped = Math.min(
        DEFAULT_GEOFENCE_RADIUS_METERS,
        Math.max(MIN_GEOFENCE_RADIUS_METERS, Math.round(radiusMeters))
      );
      const currentPrefs = preferencesRef.current;
      const updatedGym = currentPrefs.gymLocation
        ? { ...currentPrefs.gymLocation, radiusMeters: clamped }
        : null;
      const updatedPrefs: UserPreferences = {
        ...currentPrefs,
        geofenceRadiusMeters: clamped,
        gymLocation: updatedGym,
      };
      preferencesRef.current = updatedPrefs;
      setPreferences(updatedPrefs);
      await storageService.savePreferences(updatedPrefs);
      if (
        updatedGym &&
        !updatedGym.isManual &&
        updatedPrefs.autoDetectGym &&
        permissionStatus.backgroundGranted
      ) {
        await setupGymGeofence(updatedGym);
      }
      refreshLocation();
    },
    [permissionStatus.backgroundGranted, refreshLocation]
  );

  const themeMode: ThemeMode = preferences.themeMode || 'dark';
  const activeTheme = React.useMemo(() => getTheme(themeMode), [themeMode]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    const updatedPrefs: UserPreferences = {
      ...preferencesRef.current,
      themeMode: mode,
    };
    preferencesRef.current = updatedPrefs;
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
  }, []);

  const distanceUnit: DistanceUnit = preferences.distanceUnit || 'mi';

  const setDistanceUnit = useCallback(async (unit: DistanceUnit) => {
    const updatedPrefs: UserPreferences = {
      ...preferencesRef.current,
      distanceUnit: unit,
    };
    preferencesRef.current = updatedPrefs;
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
  }, []);

  const hapticsEnabled = preferences.hapticsEnabled !== false;

  const setHapticsEnabled = useCallback(async (enabled: boolean) => {
    applyHapticsEnabled(enabled);
    const updatedPrefs: UserPreferences = {
      ...preferencesRef.current,
      hapticsEnabled: enabled,
    };
    preferencesRef.current = updatedPrefs;
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
  }, []);

  const fontSizeMode: FontSizeMode = preferences.fontSizeMode || 'standard';
  const fontScale = fontSizeMode === 'large' ? 1.3 : 1;

  const setFontSizeMode = useCallback(async (mode: FontSizeMode) => {
    const updatedPrefs: UserPreferences = {
      ...preferencesRef.current,
      fontSizeMode: mode,
    };
    preferencesRef.current = updatedPrefs;
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
  }, []);

  const [isTabSwipeLocked, setIsTabSwipeLockedState] = useState(false);
  const isTabSwipeLockedRef = useRef(false);
  const setTabSwipeLocked = useCallback((locked: boolean) => {
    isTabSwipeLockedRef.current = locked;
    setIsTabSwipeLockedState(locked);
  }, []);

  const refreshPermissionStatus = useCallback(async () => {
    const perms = await getLocationPermissionStatus();
    setPermissionStatus(perms);
    return perms;
  }, []);

  const requestAutoTrackingPermission = useCallback(async () => {
    const perms = await requestLocationPermissions(true);
    setPermissionStatus(perms);
    if (preferencesRef.current.gymLocation && perms.backgroundGranted) {
      await setupGymGeofence(preferencesRef.current.gymLocation);
    }
    if (perms.foregroundGranted) {
      refreshLocation();
    }
    return perms;
  }, [refreshLocation]);

  // Layer 2: Manual or GPS-Verified Check-In
  const startManualGymSession = useCallback(async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    const gym = preferencesRef.current.gymLocation;
    if (!gym) {
      return { success: false, message: 'Please set up your gym location first.' };
    }

    if (gym.isManual) {
      await storageService.handleBackgroundGeofenceEnter(gym.name, true);
      const evalResult = await storageService.evaluatePersistedDwellSession();
      setDwellState(evalResult.dwellSession);
      setStreakState(evalResult.streakState);
      setWorkouts(evalResult.workouts);
      triggerLightHaptic();
      return {
        success: true,
        message: `Checked in at ${gym.name}! Stay checked in for ${FIXED_DWELL_MINUTES} minutes to log your workout (auto-checkout after ${MAX_MANUAL_SESSION_MINUTES} mins).`,
      };
    }

    const perms = await getLocationPermissionStatus();
    if (!perms.foregroundGranted) {
      const requested = await requestLocationPermissions(false);
      setPermissionStatus(requested);
      if (!requested.foregroundGranted) {
        return {
          success: false,
          message: 'Location permission is required to verify you are at the gym.',
        };
      }
    }

    const coords = await getCurrentCoordinates();
    if (!coords) {
      return {
        success: false,
        message: 'Could not read your GPS location. Please try again.',
      };
    }

    const distance = calculateDistanceMeters(
      coords.latitude,
      coords.longitude,
      gym.latitude,
      gym.longitude
    );
    setCurrentDistanceMeters(distance);

    const radius = gym.radiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;
    if (distance > radius) {
      return {
        success: false,
        message: `You are ${distance}m away from ${gym.name}. You must be within ${radius}m to start a workout.`,
      };
    }

    await storageService.handleBackgroundGeofenceEnter(gym.name, true);
    const evalResult = await storageService.evaluatePersistedDwellSession();
    setDwellState(evalResult.dwellSession);
    setStreakState(evalResult.streakState);
    setWorkouts(evalResult.workouts);
    triggerLightHaptic();
    return {
      success: true,
      message: `Checked in at ${gym.name}! Stay for ${FIXED_DWELL_MINUTES} minutes to log your workout.`,
    };
  }, []);

  const endManualGymSession = useCallback(async (): Promise<void> => {
    const exited = await storageService.handleBackgroundGeofenceExit();
    const [latestStreak, latestWorkouts] = await Promise.all([
      storageService.getStreakState(),
      storageService.getWorkouts(),
    ]);
    setDwellState(exited);
    setStreakState(latestStreak);
    setWorkouts(latestWorkouts);
    triggerLightHaptic();
    await syncSnapshotToCloud(
      userProfileRef.current,
      preferencesRef.current,
      latestStreak,
      latestWorkouts
    );
  }, [syncSnapshotToCloud]);

  // Simulation controls (persists to AsyncStorage and keeps tracking past 15 mins while inside gym)
  const simulateEnterGym = async () => {
    const gymName = preferences.gymLocation?.name || 'Simulated Gym';
    const session = await storageService.handleBackgroundGeofenceEnter(gymName);
    setDwellState(session);
    setCurrentDistanceMeters(10); // 10 meters away
  };

  const simulateDwellProgress = async (addMinutes: number) => {
    const today = formatDateToYYYYMMDD(new Date());
    const todayWorkout = workouts.find((w) => w.dateString === today);
    const isUpgradingToVerified = Boolean(
      todayWorkout && !todayWorkout.isVerified && preferences.gymLocation?.isVerified
    );
    const baseDwell = !dwellState.isDwelling && isUpgradingToVerified ? 0 : dwellState.minutesDwelling;
    const newDwell = baseDwell + addMinutes;
    const simulatedEnteredAt = new Date(Date.now() - newDwell * 60 * 1000).toISOString();

    const updatedSession: DwellSessionState = {
      ...dwellState,
      isDwelling: true,
      enteredAt: simulatedEnteredAt,
      minutesDwelling: newDwell,
      gymName: preferences.gymLocation?.name || dwellState.gymName || 'Local Gym',
      dateString: today,
    };
    await storageService.saveDwellSession(updatedSession);

    const evalResult = await storageService.evaluatePersistedDwellSession();
    setDwellState(evalResult.dwellSession);
    setStreakState(evalResult.streakState);
    setWorkouts(evalResult.workouts);
    setCurrentDistanceMeters(10);
    await syncSnapshotToCloud(
      userProfile,
      preferences,
      evalResult.streakState,
      evalResult.workouts
    );
  };

  const simulateLeaveGym = async () => {
    const exited = await storageService.handleBackgroundGeofenceExit();
    const [latestStreak, latestWorkouts] = await Promise.all([
      storageService.getStreakState(),
      storageService.getWorkouts(),
    ]);
    setDwellState(exited);
    setStreakState(latestStreak);
    setWorkouts(latestWorkouts);
    setCurrentDistanceMeters(2500); // 2.5 km away
    await syncSnapshotToCloud(userProfile, preferences, latestStreak, latestWorkouts);
  };

  // Test simulation: jump week and see reset behavior
  const testSimulatePreviousWeek = async (workoutsInPriorWeek: number) => {
    const prevWeekDate = new Date();
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const prevWeekId = getIsoWeekId(prevWeekDate);

    // Create fake workouts for the previous week
    const fakePriorWorkouts: WorkoutSession[] = [];
    for (let i = 0; i < workoutsInPriorWeek; i++) {
      const d = new Date(prevWeekDate);
      d.setDate(d.getDate() - i);
      fakePriorWorkouts.push({
        id: `sim_w_${i}`,
        userId: userProfile.id,
        timestamp: d.toISOString(),
        dateString: formatDateToYYYYMMDD(d),
        durationMinutes: 45,
        verifiedByGps: true,
        gymName: preferences.gymLocation?.name || 'Local Gym',
        weekId: prevWeekId,
        updatedAt: d.toISOString(),
        synced: false,
      });
    }

    const stateWithPriorWeek: StreakState = {
      ...streakState,
      userId: userProfile.id,
      currentStreak: streakState.currentStreak > 0 ? streakState.currentStreak : 5,
      lastEvaluatedWeekId: prevWeekId,
    };

    const combinedWorkouts = [...fakePriorWorkouts, ...workouts];
    const evaluated = evaluateWeeklyReset(stateWithPriorWeek, preferences, combinedWorkouts, new Date());

    setWorkouts(combinedWorkouts);
    setStreakState(evaluated);
    await storageService.saveWorkouts(combinedWorkouts);
    await storageService.saveStreakState(evaluated);
  };

  const resetAll = async () => {
    await storageService.clearAllData();
    setPreferences(DEFAULT_PREFERENCES);
    setStreakState({ ...DEFAULT_STREAK_STATE, userId: userProfile.id });
    setWorkouts([]);
    setDwellState(DEFAULT_DWELL_SESSION);
    setCurrentDistanceMeters(null);
  };

  const deleteAccount = async (): Promise<boolean> => {
    const currentId = userProfileRef.current.id;
    try {
      if (cloudDatabase.isConfigured() && currentId) {
        await cloudDatabase.deleteUserAccount(currentId);
      }
    } catch (e) {
      console.warn('Error deleting remote account:', e);
    }

    cloudDatabase.setAuthSession(null);
    await stopGymGeofence();
    await storageService.clearAllData(true);

    const freshProfile = createDefaultUserProfile();
    await storageService.saveUserProfile(freshProfile);
    userProfileRef.current = freshProfile;
    preferencesRef.current = DEFAULT_PREFERENCES;

    setUserProfile(freshProfile);
    setPreferences(DEFAULT_PREFERENCES);
    setStreakState({ ...DEFAULT_STREAK_STATE, userId: freshProfile.id });
    setWorkouts([]);
    setDwellState(DEFAULT_DWELL_SESSION);
    setCurrentDistanceMeters(null);
    setFriendships({ friends: [], incomingRequests: [], outgoingRequests: [] });
    return true;
  };

  return (
    <FitnessContext.Provider
      value={{
        userProfile,
        preferences,
        streakState,
        workouts,
        dwellState,
        currentDistanceMeters,
        permissionStatus,
        isLoading,
        isCloudConfigured: cloudDatabase.isConfigured(),
        isSyncingCloud,
        friendships,
        updateUserProfile,
        updateLiftPrs,
        setPreferredWeightUnit,
        signInWithAccount,
        handleOAuthRedirectUrl,
        signOutAccount,
        deleteAccount,
        setWeeklyGoal,
        scheduleGoalForMonday,
        cancelPendingGoal,
        updateGymLocation,
        setAutoDetectGym,
        setGeofenceRadiusMeters,
        themeMode,
        theme: activeTheme,
        setThemeMode,
        distanceUnit,
        setDistanceUnit,
        hapticsEnabled,
        setHapticsEnabled,
        fontSizeMode,
        fontScale,
        setFontSizeMode,
        isTabSwipeLocked,
        isTabSwipeLockedRef,
        setTabSwipeLocked,
        refreshLocation,
        refreshPermissionStatus,
        requestAutoTrackingPermission,
        startManualGymSession,
        endManualGymSession,
        syncToCloud,
        fetchLeaderboardEntries,
        searchExistingGyms,
        submitGymReport,
        submitBugReport,
        refreshFriendships,
        searchUsersForFriend,
        sendFriendRequestToUser,
        respondToFriendRequest,
        simulateEnterGym,
        simulateDwellProgress,
        simulateLeaveGym,
        testSimulatePreviousWeek,
        resetAll,
      }}
    >
      {children}
    </FitnessContext.Provider>
  );
};

export const useFitness = (): FitnessContextType => {
  const context = useContext(FitnessContext);
  if (!context) {
    throw new Error('useFitness must be used within a FitnessProvider');
  }
  return context;
};
