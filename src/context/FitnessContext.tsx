import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import {
  UserProfile,
  UserPreferences,
  WorkoutSession,
  StreakState,
  GymLocation,
  DwellSessionState,
  AuthProviderType,
  FIXED_DWELL_MINUTES,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from '../types/fitness';
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
  subscribeToLocationUpdates,
} from '../services/locationService';
import {
  cloudDatabase,
  FriendshipsOverview,
  RemoteLeaderboardUser,
} from '../services/cloud';
import { formatDateToYYYYMMDD, getIsoWeekId } from '../utils/dateUtils';

export interface SignInAccountInput {
  fullName: string;
  email?: string;
  authProvider: AuthProviderType;
}

interface FitnessContextType {
  userProfile: UserProfile;
  preferences: UserPreferences;
  streakState: StreakState;
  workouts: WorkoutSession[];
  dwellState: DwellSessionState;
  currentDistanceMeters: number | null;
  isLoading: boolean;
  isCloudConfigured: boolean;
  isSyncingCloud: boolean;
  friendships: FriendshipsOverview;
  updateUserProfile: (fullName: string, options?: { email?: string; authProvider?: AuthProviderType }) => Promise<void>;
  signInWithAccount: (input: SignInAccountInput) => Promise<{ restoredExisting: boolean }>;
  handleOAuthRedirectUrl: (url: string) => Promise<boolean>;
  signOutAccount: () => Promise<void>;
  setWeeklyGoal: (goal: number) => Promise<void>;
  scheduleGoalForMonday: (goal: number) => Promise<void>;
  cancelPendingGoal: () => Promise<void>;
  updateGymLocation: (location: GymLocation) => Promise<void>;
  refreshLocation: () => Promise<void>;
  syncToCloud: () => Promise<void>;
  fetchLeaderboardEntries: (
    category: 'global' | 'gym' | 'friends'
  ) => Promise<RemoteLeaderboardUser[]>;
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
          gymId: prefsSnap.gymLocation?.id || null,
          gymName: prefsSnap.gymLocation?.name || null,
          currentStreak: streakSnap.currentStreak,
          bestStreak: streakSnap.bestStreak,
          totalGymTimeMinutes,
          workoutsCount: workoutsSnap.length,
          weeklyGoal: prefsSnap.weeklyGoal,
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
      const [savedProfile, savedPrefs, savedWorkouts, savedStreak] = await Promise.all([
        storageService.getUserProfile(),
        storageService.getPreferences(),
        storageService.getWorkouts(),
        storageService.getStreakState(),
      ]);

      // Ensure defaults & locked values
      savedPrefs.dwellDurationMinutes = FIXED_DWELL_MINUTES;
      if (savedPrefs.gymLocation) {
        savedPrefs.gymLocation.dwellMinutesRequired = FIXED_DWELL_MINUTES;
        savedPrefs.gymLocation.radiusMeters = DEFAULT_GEOFENCE_RADIUS_METERS;
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
        new Date()
      );
      await storageService.saveStreakState(evaluatedStreak);

      // Evaluate any persisted background dwell session
      const dwellEval = await storageService.evaluatePersistedDwellSession();

      setUserProfile(savedProfile);
      setPreferences(savedPrefs);
      setWorkouts(dwellEval.workouts);
      setStreakState(dwellEval.streakState);
      setDwellState(dwellEval.dwellSession);

      // Push latest stats to cloud database & load friendships in background
      syncSnapshotToCloud(
        savedProfile,
        savedPrefs,
        dwellEval.streakState,
        dwellEval.workouts
      );
      cloudDatabase.fetchFriendships(savedProfile.id).then((overview) => {
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
    options?: { email?: string; authProvider?: AuthProviderType }
  ) => {
    const trimmed = fullName.trim();
    const updatedProfile: UserProfile = {
      ...userProfile,
      fullName: trimmed,
      userTag: userProfile.userTag || generateUserTag(userProfile.id),
      email: options?.email !== undefined ? options.email.trim().toLowerCase() || null : userProfile.email,
      authProvider: options?.authProvider || userProfile.authProvider || 'device',
      hasCompletedOnboarding: Boolean(trimmed),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storageService.saveUserProfile(updatedProfile);
    setUserProfile(saved);
    await syncSnapshotToCloud(saved, preferences, streakState, workouts);
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
          hasCompletedOnboarding: true,
          updatedAt: new Date().toISOString(),
        };

        const restoredStreak: StreakState = {
          ...streakState,
          userId: existingRemote.id,
          currentStreak: Math.max(streakState.currentStreak, existingRemote.currentStreak),
          bestStreak: Math.max(streakState.bestStreak, existingRemote.bestStreak),
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
      const identity = await cloudDatabase.getUserFromAccessToken(accessToken, 'google');
      if (!identity) {
        Alert.alert('Sign-In Error', 'Could not retrieve your Google/Apple profile from token.');
        return false;
      }

      await signInWithAccount({
        fullName: identity.fullName,
        email: identity.email,
        authProvider: identity.provider,
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
    setCurrentDistanceMeters(distance);
    const radius = gym.radiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;

    if (distance <= radius) {
      await storageService.handleBackgroundGeofenceEnter(gym.name);
      const evalResult = await storageService.evaluatePersistedDwellSession();
      setDwellState(evalResult.dwellSession);
      setStreakState(evalResult.streakState);
      setWorkouts(evalResult.workouts);
      if (evalResult.completedNow) {
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
    if (!gym) return;
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

  // Listen to AppState so when user unlocks phone or reopens app, persisted dwell time & background events sync immediately
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const evalResult = await storageService.evaluatePersistedDwellSession();
        setDwellState(evalResult.dwellSession);
        setStreakState(evalResult.streakState);
        setWorkouts(evalResult.workouts);
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

    if (preferences.gymLocation) {
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
      updatedPrefs.gymLocation.radiusMeters = DEFAULT_GEOFENCE_RADIUS_METERS;
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

  // Update Gym Location with locked 300m radius and 15 min dwell
  const updateGymLocation = async (location: GymLocation) => {
    const lockedLocation: GymLocation = {
      ...location,
      radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS, // Fixed at 300m
      dwellMinutesRequired: FIXED_DWELL_MINUTES, // Fixed at 15m
    };
    const updatedPrefs: UserPreferences = { ...preferences, gymLocation: lockedLocation };
    setPreferences(updatedPrefs);
    await storageService.savePreferences(updatedPrefs);
    refreshLocation();
    await syncSnapshotToCloud(userProfile, updatedPrefs, streakState, workouts);
  };

  // Simulation controls (persists to AsyncStorage and keeps tracking past 15 mins while inside gym)
  const simulateEnterGym = async () => {
    const gymName = preferences.gymLocation?.name || 'Simulated Gym';
    const session = await storageService.handleBackgroundGeofenceEnter(gymName);
    setDwellState(session);
    setCurrentDistanceMeters(10); // 10 meters away
  };

  const simulateDwellProgress = async (addMinutes: number) => {
    const newDwell = dwellState.minutesDwelling + addMinutes;
    const simulatedEnteredAt = new Date(Date.now() - newDwell * 60 * 1000).toISOString();

    const updatedSession: DwellSessionState = {
      ...dwellState,
      isDwelling: true,
      enteredAt: simulatedEnteredAt,
      minutesDwelling: newDwell,
      gymName: dwellState.gymName || preferences.gymLocation?.name || 'Local Gym',
      dateString: formatDateToYYYYMMDD(new Date()),
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

  return (
    <FitnessContext.Provider
      value={{
        userProfile,
        preferences,
        streakState,
        workouts,
        dwellState,
        currentDistanceMeters,
        isLoading,
        isCloudConfigured: cloudDatabase.isConfigured(),
        isSyncingCloud,
        friendships,
        updateUserProfile,
        signInWithAccount,
        handleOAuthRedirectUrl,
        signOutAccount,
        setWeeklyGoal,
        scheduleGoalForMonday,
        cancelPendingGoal,
        updateGymLocation,
        refreshLocation,
        syncToCloud,
        fetchLeaderboardEntries,
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
