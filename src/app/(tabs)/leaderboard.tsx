import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFitness } from '../../context/FitnessContext';
import { triggerLightHaptic } from '../../utils/haptics';
import { RemoteLeaderboardUser } from '../../services/cloud';
import { AgeRangeSlider, MAX_AGE_BOUND, MIN_AGE_BOUND } from '../../components/AgeRangeSlider';
import { UserGender, WeightUnit } from '../../types/fitness';
import { formatWeightWithUnit } from '../../utils/weightUtils';
import { AppTheme } from '../../constants/theme';

type LeaderboardCategory = 'global' | 'gym' | 'friends';
type GenderFilter = 'all' | 'male' | 'female';
type LeaderboardFilter =
  | 'currentStreak'
  | 'bestStreak'
  | 'totalGymTime'
  | 'total'
  | 'squat'
  | 'bench'
  | 'deadlift';

interface LeaderboardEntry {
  id: string;
  name: string;
  userTag: string;
  isCurrentUser: boolean;
  gymName: string;
  isVerified: boolean;
  gender?: UserGender;
  age?: number | null;
  currentStreak: number;
  bestStreak: number;
  personalCurrentStreak: number;
  personalBestStreak: number;
  verifiedCurrentStreak: number;
  verifiedBestStreak: number;
  workoutsCount: number;
  weeklyGoal: number;
  totalGymTimeMinutes: number;
  squatPrKg: number;
  benchPrKg: number;
  deadliftPrKg: number;
  totalPrKg: number;
}

const CATEGORIES: {
  key: LeaderboardCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
    { key: 'global', label: 'Global', icon: 'globe-outline' },
    { key: 'gym', label: 'Gym', icon: 'barbell-outline' },
    { key: 'friends', label: 'Friends', icon: 'people-outline' },
  ];

const FILTERS: {
  key: LeaderboardFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
    { key: 'currentStreak', label: 'Current Streak', icon: 'flame-outline' },
    { key: 'bestStreak', label: 'Best Streak', icon: 'trophy-outline' },
    { key: 'totalGymTime', label: 'Gym Time', icon: 'time-outline' },
    { key: 'total', label: 'Total', icon: 'podium-outline' },
    { key: 'squat', label: 'Squat', icon: 'barbell-outline' },
    { key: 'bench', label: 'Bench', icon: 'barbell-outline' },
    { key: 'deadlift', label: 'Deadlift', icon: 'barbell-outline' },
  ];

function formatGymTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export default function LeaderboardScreen() {
  const {
    userProfile,
    preferences,
    streakState,
    workouts,
    isCloudConfigured,
    friendships,
    syncToCloud,
    fetchLeaderboardEntries,
    refreshFriendships,
    searchUsersForFriend,
    setTabSwipeLocked,
    sendFriendRequestToUser,
    respondToFriendRequest,
    setPreferredWeightUnit,
    theme,
  } = useFitness();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategory>('global');
  const [selectedFilter, setSelectedFilter] = useState<LeaderboardFilter>('currentStreak');
  const [selectedGender, setSelectedGender] = useState<GenderFilter>('all');
  const [minAge, setMinAge] = useState<number>(MIN_AGE_BOUND);
  const [maxAge, setMaxAge] = useState<number>(MAX_AGE_BOUND);
  const [moreFiltersVisible, setMoreFiltersVisible] = useState<boolean>(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(
    userProfile.preferredWeightUnit || 'lbs'
  );
  const [remoteUsers, setRemoteUsers] = useState<RemoteLeaderboardUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (userProfile.preferredWeightUnit) {
      setWeightUnit(userProfile.preferredWeightUnit);
    }
  }, [userProfile.preferredWeightUnit]);

  const handleToggleWeightUnit = (unit: WeightUnit) => {
    setWeightUnit(unit);
    setPreferredWeightUnit(unit);
  };

  // Friend search state
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RemoteLeaderboardUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [copiedTag, setCopiedTag] = useState(false);

  const handleCopyFriendTag = async () => {
    const tagText = `${userProfile.fullName || 'You'} #${userProfile.userTag || '4821'}`;
    await Clipboard.setStringAsync(tagText);
    triggerLightHaptic();
    setCopiedTag(true);
    setTimeout(() => setCopiedTag(false), 2000);
  };

  const loadLeaderboard = useCallback(async () => {
    if (!isCloudConfigured) {
      setRemoteUsers([]);
      return;
    }
    try {
      await syncToCloud();
      const [fetched] = await Promise.all([
        fetchLeaderboardEntries(selectedCategory),
        refreshFriendships(),
      ]);
      setRemoteUsers(fetched);
    } catch (e) {
      console.warn('Failed to load remote leaderboard:', e);
    }
  }, [isCloudConfigured, syncToCloud, fetchLeaderboardEntries, refreshFriendships, selectedCategory]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    setTabSwipeLocked(moreFiltersVisible);
    return () => setTabSwipeLocked(false);
  }, [moreFiltersVisible, setTabSwipeLocked]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  // Search athletes by Name or #Tag when typing in Friends tab
  useEffect(() => {
    const q = friendSearchQuery.trim();
    if (!q || !isCloudConfigured) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchUsersForFriend(q);
      if (!cancelled) {
        setSearchResults(results);
        setSearching(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [friendSearchQuery, isCloudConfigured, searchUsersForFriend]);

  const totalGymTimeMinutes = useMemo(
    () => workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0),
    [workouts]
  );
  const [selectedEntry, setSelectedEntry] = useState<{
    entry: LeaderboardEntry;
    rank: number;
  } | null>(null);

  const currentUserEntry: LeaderboardEntry = useMemo(
    () => {
      const squat = userProfile.squatPrKg ?? 0;
      const bench = userProfile.benchPrKg ?? 0;
      const deadlift = userProfile.deadliftPrKg ?? 0;
      const useVerifiedStreak = selectedCategory !== 'friends';
      return {
        id: userProfile.id || 'current-user',
        name: userProfile.fullName || 'You',
        userTag: userProfile.userTag || '4821',
        isCurrentUser: true,
        gymName: preferences.gymLocation?.name || 'No Gym Selected',
        isVerified: Boolean(preferences.gymLocation?.isVerified),
        gender: userProfile.gender ?? null,
        age: userProfile.age ?? null,
        currentStreak: useVerifiedStreak
          ? streakState.verifiedStreak ?? 0
          : streakState.currentStreak,
        bestStreak: useVerifiedStreak
          ? streakState.bestVerifiedStreak ?? 0
          : streakState.bestStreak,
        personalCurrentStreak: streakState.currentStreak,
        personalBestStreak: streakState.bestStreak,
        verifiedCurrentStreak: streakState.verifiedStreak ?? 0,
        verifiedBestStreak: streakState.bestVerifiedStreak ?? 0,
        workoutsCount: workouts.length,
        weeklyGoal: preferences.weeklyGoal,
        totalGymTimeMinutes,
        squatPrKg: squat,
        benchPrKg: bench,
        deadliftPrKg: deadlift,
        totalPrKg: squat + bench + deadlift,
      };
    },
    [
      userProfile,
      preferences.gymLocation,
      preferences.weeklyGoal,
      streakState,
      totalGymTimeMinutes,
      workouts.length,
      selectedCategory,
    ]
  );

  const friendIdSet = useMemo(
    () => new Set(friendships.friends.map((f) => f.id)),
    [friendships.friends]
  );

  const incomingRequestMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const req of friendships.incomingRequests) {
      map.set(req.user.id, req.requestId);
    }
    return map;
  }, [friendships.incomingRequests]);

  const outgoingRequestSet = useMemo(
    () => new Set(friendships.outgoingRequests.map((r) => r.user.id)),
    [friendships.outgoingRequests]
  );

  // Merge remote users with the current user's live data and sort by the active filter
  const entries = useMemo(() => {
    const sourceUsers =
      selectedCategory === 'friends' ? friendships.friends : remoteUsers;

    const otherEntries: LeaderboardEntry[] = sourceUsers
      .filter((u) => u.id !== currentUserEntry.id)
      .filter((u) => {
        if (selectedCategory === 'gym') {
          if (!u.isVerified) return false;
          if (!preferences.gymLocation?.name || !preferences.gymLocation?.isVerified) {
            return false;
          }
          return (
            u.gymName.toLowerCase() === preferences.gymLocation.name.toLowerCase() ||
            (preferences.gymLocation.id && u.gymId === preferences.gymLocation.id)
          );
        }
        return true;
      })
      .map((u) => {
        const squat = u.squatPrKg ?? 0;
        const bench = u.benchPrKg ?? 0;
        const deadlift = u.deadliftPrKg ?? 0;
        const useVerifiedStreak = selectedCategory !== 'friends';
        return {
          id: u.id,
          name: u.fullName || 'Athlete',
          userTag: u.userTag || '0000',
          isCurrentUser: false,
          gymName: u.gymName || 'No Gym Selected',
          isVerified: Boolean(u.isVerified),
          gender: u.gender ?? null,
          age: u.age ?? null,
          currentStreak: useVerifiedStreak ? u.verifiedStreak ?? 0 : u.currentStreak,
          bestStreak: useVerifiedStreak ? u.bestVerifiedStreak ?? 0 : u.bestStreak,
          personalCurrentStreak: u.currentStreak,
          personalBestStreak: u.bestStreak,
          verifiedCurrentStreak: u.verifiedStreak ?? 0,
          verifiedBestStreak: u.bestVerifiedStreak ?? 0,
          workoutsCount: u.workoutsCount ?? 0,
          weeklyGoal: u.weeklyGoal ?? 2,
          totalGymTimeMinutes: u.totalGymTimeMinutes,
          squatPrKg: squat,
          benchPrKg: bench,
          deadliftPrKg: deadlift,
          totalPrKg: squat + bench + deadlift,
        };
      });

    const includeCurrentUser =
      selectedCategory !== 'gym' || currentUserEntry.isVerified;
    const rawList = includeCurrentUser
      ? [currentUserEntry, ...otherEntries]
      : [...otherEntries];
    const isAgeFiltered = minAge > MIN_AGE_BOUND || maxAge < MAX_AGE_BOUND;
    const list = rawList.filter((entry) => {
      if (selectedGender !== 'all' && entry.gender !== selectedGender) {
        return false;
      }
      if (isAgeFiltered) {
        if (typeof entry.age !== 'number') return false;
        if (entry.age < minAge) return false;
        if (maxAge < MAX_AGE_BOUND && entry.age > maxAge) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (selectedFilter === 'currentStreak') return b.currentStreak - a.currentStreak;
      if (selectedFilter === 'bestStreak') return b.bestStreak - a.bestStreak;
      if (selectedFilter === 'totalGymTime') {
        return b.totalGymTimeMinutes - a.totalGymTimeMinutes;
      }
      if (selectedFilter === 'total') return b.totalPrKg - a.totalPrKg;
      if (selectedFilter === 'squat') return b.squatPrKg - a.squatPrKg;
      if (selectedFilter === 'bench') return b.benchPrKg - a.benchPrKg;
      return b.deadliftPrKg - a.deadliftPrKg;
    });
    return list;
  }, [
    remoteUsers,
    friendships.friends,
    currentUserEntry,
    selectedCategory,
    selectedFilter,
    selectedGender,
    minAge,
    maxAge,
    preferences.gymLocation,
  ]);

  const flatListRef = useRef<FlatList<LeaderboardEntry>>(null);
  const currentUserIndex = useMemo(
    () => entries.findIndex((e) => e.isCurrentUser),
    [entries]
  );

  const handleSendFriendRequest = async (targetUserId: string, targetName: string) => {
    const res = await sendFriendRequestToUser(targetUserId);
    Alert.alert(res.success ? 'Friend Request' : 'Notice', res.message || `Request sent to ${targetName}`);
    await loadLeaderboard();
  };

  const handleRespondRequest = async (requestId: string, accept: boolean) => {
    await respondToFriendRequest(requestId, accept);
    await loadLeaderboard();
  };

  const getCategorySubtitle = (): string => {
    if (selectedCategory === 'global') {
      return 'Worldwide rankings across all athletes';
    }
    if (selectedCategory === 'gym') {
      return preferences.gymLocation?.name
        ? `Members training at ${preferences.gymLocation.name}`
        : 'Members at your home gym';
    }
    return 'Mutual friends competing with you';
  };

  const renderMetricDisplay = (item: LeaderboardEntry) => {
    if (selectedFilter === 'currentStreak') {
      return {
        value: `${item.currentStreak} 🔥`,
        unit: 'visit streak',
      };
    }
    if (selectedFilter === 'bestStreak') {
      return {
        value: `${item.bestStreak} 🏆`,
        unit: 'best streak',
      };
    }
    if (selectedFilter === 'totalGymTime') {
      return {
        value: formatGymTime(item.totalGymTimeMinutes),
        unit: `${item.totalGymTimeMinutes} mins total`,
      };
    }
    if (selectedFilter === 'total') {
      return {
        value: formatWeightWithUnit(item.totalPrKg, weightUnit),
        unit: 'SBD total',
      };
    }
    if (selectedFilter === 'squat') {
      return {
        value: formatWeightWithUnit(item.squatPrKg, weightUnit),
        unit: 'squat PR',
      };
    }
    if (selectedFilter === 'bench') {
      return {
        value: formatWeightWithUnit(item.benchPrKg, weightUnit),
        unit: 'bench PR',
      };
    }
    return {
      value: formatWeightWithUnit(item.deadliftPrKg, weightUnit),
      unit: 'deadlift PR',
    };
  };

  const renderFriendStatusButton = (userId: string, userName: string) => {
    if (userId === currentUserEntry.id) return null;

    if (friendIdSet.has(userId)) {
      return (
        <View style={styles.friendStatusBadge}>
          <Ionicons name="checkmark-circle" size={12} color={theme.successLight} />
          <Text style={styles.friendStatusBadgeText}>Friend</Text>
        </View>
      );
    }

    const incomingReqId = incomingRequestMap.get(userId);
    if (incomingReqId) {
      return (
        <TouchableOpacity
          style={styles.acceptQuickBtn}
          onPress={() => handleRespondRequest(incomingReqId, true)}
        >
          <Text style={styles.acceptQuickBtnText}>Accept</Text>
        </TouchableOpacity>
      );
    }

    if (outgoingRequestSet.has(userId)) {
      return (
        <View style={styles.pendingQuickBadge}>
          <Text style={styles.pendingQuickBadgeText}>Pending</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.addFriendQuickBtn}
        onPress={() => handleSendFriendRequest(userId, userName)}
      >
        <Ionicons name="person-add-outline" size={11} color={theme.primaryLight} />
        <Text style={styles.addFriendQuickBtnText}>Add</Text>
      </TouchableOpacity>
    );
  };

  const renderLeaderboardItem = ({
    item,
    index,
  }: {
    item: LeaderboardEntry;
    index: number;
  }) => {
    const rank = index + 1;
    const metric = renderMetricDisplay(item);

    return (
      <TouchableOpacity
        style={[
          styles.entryCard,
          item.isCurrentUser && styles.currentUserCard,
        ]}
        onPress={() => setSelectedEntry({ entry: item, rank })}
        activeOpacity={0.82}
      >
        {/* Rank Badge */}
        <View style={[styles.rankBadge, rank === 1 && styles.firstRankBadge]}>
          <Text style={[styles.rankText, rank === 1 && styles.firstRankText]}>
            #{rank}
          </Text>
        </View>

        {/* User Info & Sub-metrics */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.userTagText}>#{item.userTag}</Text>
            {item.isCurrentUser ? (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            ) : (
              renderFriendStatusButton(item.id, item.name)
            )}
          </View>

          <Text style={styles.gymSubtitle} numberOfLines={1}>
            {item.gymName}
            {!item.isVerified && item.gymName !== 'No Gym Selected' ? ' • Custom' : ''}
          </Text>

          <View style={styles.miniStatsRow}>
            <View
              style={[
                styles.miniStatPill,
                selectedFilter === 'currentStreak' && styles.miniStatPillActive,
              ]}
            >
              <Text style={styles.miniStatText}>
                🔥 {item.currentStreak}
              </Text>
            </View>
            <View
              style={[
                styles.miniStatPill,
                selectedFilter === 'bestStreak' && styles.miniStatPillActive,
              ]}
            >
              <Text style={styles.miniStatText}>
                🏆 {item.bestStreak}
              </Text>
            </View>
            <View
              style={[
                styles.miniStatPill,
                selectedFilter === 'totalGymTime' && styles.miniStatPillActive,
              ]}
            >
              <Text style={styles.miniStatText}>
                ⏱️ {formatGymTime(item.totalGymTimeMinutes)}
              </Text>
            </View>
            <View
              style={[
                styles.miniStatPill,
                selectedFilter === 'total' && styles.miniStatPillActive,
              ]}
            >
              <Text style={styles.miniStatText}>
                🏋️ {formatWeightWithUnit(item.totalPrKg, weightUnit)}
              </Text>
            </View>
          </View>
        </View>

        {/* Primary Highlighted Filter Metric */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>{metric.value}</Text>
          <Text style={styles.metricUnit}>{metric.unit}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const friendsHeaderElement =
    selectedCategory !== 'friends' ? undefined : (
      <View style={styles.friendsHeaderContainer}>
        {/* Your Shareable Tag Card */}
        <View style={styles.yourTagBar}>
          <View style={styles.yourTagLeft}>
            <Ionicons name="pricetag-outline" size={16} color={theme.primaryLight} />
            <Text style={styles.yourTagLabel}>Your Friend Tag:</Text>
          </View>
          <TouchableOpacity
            style={styles.yourTagValueBadge}
            onPress={handleCopyFriendTag}
            activeOpacity={0.75}
          >
            <Text style={styles.yourTagValueText}>
              {userProfile.fullName || 'You'} #{userProfile.userTag || '4821'}
            </Text>
            <Ionicons
              name={copiedTag ? 'checkmark' : 'copy-outline'}
              size={14}
              color={copiedTag ? theme.successLight : theme.primaryLight}
            />
          </TouchableOpacity>
        </View>

        {/* Search & Add Friend Box */}
        <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>Add Friend by Name or #Tag</Text>
          <View style={styles.searchInputRow}>
            <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={friendSearchQuery}
              onChangeText={setFriendSearchQuery}
              onFocus={() =>
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
              }
              placeholder="Search e.g. Alex Rivera or #7390"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {friendSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setFriendSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {friendSearchQuery.trim().length > 0 && (
            <View style={styles.searchResultsBox}>
              {searching ? (
                <Text style={styles.searchEmptyText}>Searching...</Text>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <View key={user.id} style={styles.searchResultRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.searchResultName}>{user.fullName}</Text>
                        <Text style={styles.userTagText}>#{user.userTag}</Text>
                      </View>
                      <Text style={styles.searchResultSub}>{user.gymName}</Text>
                    </View>
                    {renderFriendStatusButton(user.id, user.fullName)}
                  </View>
                ))
              ) : (
                <Text style={styles.searchEmptyText}>
                  No athletes found matching "{friendSearchQuery}".
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Incoming Mutual Friend Requests */}
        {friendships.incomingRequests.length > 0 && (
          <View style={styles.requestsCard}>
            <View style={styles.requestsHeaderRow}>
              <Ionicons name="mail-unread-outline" size={16} color={theme.warning} />
              <Text style={styles.requestsTitle}>
                Friend Requests ({friendships.incomingRequests.length})
              </Text>
            </View>
            {friendships.incomingRequests.map((req) => (
              <View key={req.requestId} style={styles.requestItemRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.requestUserName}>{req.user.fullName}</Text>
                    <Text style={styles.userTagText}>#{req.user.userTag}</Text>
                  </View>
                  <Text style={styles.requestUserSub}>
                    {req.user.gymName} • 🔥 {req.user.currentStreak} streak
                  </Text>
                </View>
                <View style={styles.requestActionsRow}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleRespondRequest(req.requestId, true)}
                  >
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => handleRespondRequest(req.requestId, false)}
                  >
                    <Ionicons name="close" size={15} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 1. Subcategory Tabs: Global | Gym | Friends */}
        <View style={styles.categoryBar}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.key;
            const incomingCount =
              cat.key === 'friends' ? friendships.incomingRequests.length : 0;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryTab, active && styles.categoryTabActive]}
                onPress={() => setSelectedCategory(cat.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon}
                  size={16}
                  color={active ? theme.onPrimary : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    active && styles.categoryTabTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
                {incomingCount > 0 && (
                  <View style={styles.tabNotifDot}>
                    <Text style={styles.tabNotifDotText}>{incomingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Friends Header (Your Tag, Add Friend Search, Incoming Requests) */}
        {friendsHeaderElement}

        {/* 2. Filter Pills & More Button */}
        <View style={styles.filterSection}>
          <View style={styles.filterHeaderRow}>
            <Text style={styles.filterHeaderLabel}>SORT BY</Text>
            <TouchableOpacity
              style={[
                styles.moreBtn,
                (selectedGender !== 'all' ||
                  minAge > MIN_AGE_BOUND ||
                  maxAge < MAX_AGE_BOUND) &&
                  styles.moreBtnActive,
              ]}
              onPress={() => setMoreFiltersVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="options-outline"
                size={14}
                color={
                  selectedGender !== 'all' ||
                  minAge > MIN_AGE_BOUND ||
                  maxAge < MAX_AGE_BOUND
                    ? theme.primaryLight
                    : theme.textSecondary
                }
              />
              <Text
                style={[
                  styles.moreBtnText,
                  (selectedGender !== 'all' ||
                    minAge > MIN_AGE_BOUND ||
                    maxAge < MAX_AGE_BOUND) &&
                    styles.moreBtnTextActive,
                ]}
              >
                More
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterWrapRow}>
            {FILTERS.map((filter) => {
              const active = selectedFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedFilter(filter.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={filter.icon}
                    size={13}
                    color={active ? theme.primaryLight : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Category Context Banner */}
        <View style={styles.contextBanner}>
          <View>
            <Text style={styles.contextTitle}>
              {CATEGORIES.find((c) => c.key === selectedCategory)?.label} Leaderboard
            </Text>
            <Text style={styles.contextSubtitle}>{getCategorySubtitle()}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {entries.length} {entries.length === 1 ? 'Athlete' : 'Athletes'}
            </Text>
          </View>
        </View>

        {/* Custom Gym Notice on Gym Tab */}
        {selectedCategory === 'gym' && !currentUserEntry.isVerified && (
          <View style={styles.customGymNotice}>
            <Ionicons name="shield-outline" size={16} color={theme.warning} />
            <Text style={styles.customGymNoticeText}>
              Custom gyms only count on your Personal & Friends leaderboards. Select a verified gym in Goal & Gym to compete on the Gym leaderboard.
            </Text>
          </View>
        )}

        {/* Leaderboard List */}
        <FlatList
          ref={flatListRef}
          data={entries}
          keyExtractor={(item) => `${selectedCategory}-${item.id}`}
          renderItem={renderLeaderboardItem}
          contentContainerStyle={[
            styles.listContent,
            currentUserIndex >= 5 && { paddingBottom: 76 },
          ]}
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={() => {}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primaryLight}
            />
          }
        />

        {/* Pinned "You • #Rank" Bar when ranked further down the list */}
        {currentUserIndex >= 5 && entries[currentUserIndex] && (
          <TouchableOpacity
            style={styles.pinnedRankBar}
            activeOpacity={0.88}
            onPress={() =>
              flatListRef.current?.scrollToIndex({
                index: currentUserIndex,
                animated: true,
                viewPosition: 0.3,
              })
            }
          >
            <View style={styles.pinnedRankLeft}>
              <View style={styles.pinnedRankBadge}>
                <Text style={styles.pinnedRankBadgeText}>#{currentUserIndex + 1}</Text>
              </View>
              <Text style={styles.pinnedRankText} numberOfLines={1}>
                You • #{currentUserIndex + 1}
              </Text>
            </View>
            <View style={styles.pinnedRankRight}>
              <Text style={styles.pinnedRankMetric}>
                {renderMetricDisplay(entries[currentUserIndex]).value}
              </Text>
              <Ionicons name="arrow-up-circle-outline" size={18} color={theme.primaryLight} />
            </View>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>

      {/* More Filters Modal (Gender, lbs/kg, Age Range Slider) */}
      <Modal
        visible={moreFiltersVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setMoreFiltersVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="options-outline" size={20} color={theme.primaryLight} />
                <Text style={styles.modalTitle}>Filters & Units</Text>
              </View>
              <TouchableOpacity
                onPress={() => setMoreFiltersVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Weight Unit Toggle */}
            <Text style={styles.modalSectionLabel}>Weight Unit</Text>
            <View style={styles.modalToggleRow}>
              <TouchableOpacity
                style={[
                  styles.modalToggleBtn,
                  weightUnit === 'lbs' && styles.modalToggleBtnActive,
                ]}
                onPress={() => handleToggleWeightUnit('lbs')}
              >
                <Text
                  style={[
                    styles.modalToggleText,
                    weightUnit === 'lbs' && styles.modalToggleTextActive,
                  ]}
                >
                  lbs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalToggleBtn,
                  weightUnit === 'kg' && styles.modalToggleBtnActive,
                ]}
                onPress={() => handleToggleWeightUnit('kg')}
              >
                <Text
                  style={[
                    styles.modalToggleText,
                    weightUnit === 'kg' && styles.modalToggleTextActive,
                  ]}
                >
                  kg
                </Text>
              </TouchableOpacity>
            </View>

            {/* Gender Filter */}
            <Text style={styles.modalSectionLabel}>Gender</Text>
            <View style={styles.modalToggleRow}>
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'male', label: 'Men' },
                  { key: 'female', label: 'Women' },
                ] as { key: GenderFilter; label: string }[]
              ).map((g) => (
                <TouchableOpacity
                  key={g.key}
                  style={[
                    styles.modalToggleBtn,
                    selectedGender === g.key && styles.modalToggleBtnActive,
                  ]}
                  onPress={() => setSelectedGender(g.key)}
                >
                  <Text
                    style={[
                      styles.modalToggleText,
                      selectedGender === g.key && styles.modalToggleTextActive,
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Age Range Slider */}
            <View style={styles.modalAgeSection}>
              <AgeRangeSlider
                minAge={minAge}
                maxAge={maxAge}
                onChange={(nextMin, nextMax) => {
                  setMinAge(nextMin);
                  setMaxAge(nextMax);
                }}
              />
            </View>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={() => {
                  setSelectedGender('all');
                  setMinAge(MIN_AGE_BOUND);
                  setMaxAge(MAX_AGE_BOUND);
                }}
              >
                <Text style={styles.modalResetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setMoreFiltersVisible(false)}
              >
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Enlarged Athlete Stats Modal */}
      <Modal
        visible={Boolean(selectedEntry)}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedEntry(null)}
        >
          {selectedEntry && (
            <TouchableOpacity
              style={styles.detailModalCard}
              activeOpacity={1}
              onPress={() => {}}
            >
              {/* Header */}
              <View style={styles.detailHeader}>
                <View
                  style={[
                    styles.rankBadge,
                    selectedEntry.rank === 1 && styles.firstRankBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.rankText,
                      selectedEntry.rank === 1 && styles.firstRankText,
                    ]}
                  >
                    #{selectedEntry.rank}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.detailName} numberOfLines={1}>
                      {selectedEntry.entry.name}
                    </Text>
                    <Text style={styles.userTagText}>
                      #{selectedEntry.entry.userTag}
                    </Text>
                    {selectedEntry.entry.isCurrentUser && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.detailGymText} numberOfLines={1}>
                    {selectedEntry.entry.gymName}
                    {!selectedEntry.entry.isVerified &&
                    selectedEntry.entry.gymName !== 'No Gym Selected'
                      ? ' • Custom Gym'
                      : selectedEntry.entry.isVerified
                      ? ' • Verified Gym'
                      : ''}
                  </Text>
                </View>

                <TouchableOpacity onPress={() => setSelectedEntry(null)}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Optional Athlete Meta + Friend Action */}
              <View style={styles.detailMetaRow}>
                {selectedEntry.entry.gender && (
                  <View style={styles.detailMetaPill}>
                    <Text style={styles.detailMetaText}>
                      {selectedEntry.entry.gender === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </View>
                )}
                {selectedEntry.entry.age ? (
                  <View style={styles.detailMetaPill}>
                    <Text style={styles.detailMetaText}>
                      Age {selectedEntry.entry.age}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.detailMetaPill}>
                  <Text style={styles.detailMetaText}>
                    Goal {selectedEntry.entry.weeklyGoal}/wk
                  </Text>
                </View>
                {!selectedEntry.entry.isCurrentUser && (
                  <View style={{ marginLeft: 'auto' }}>
                    {renderFriendStatusButton(
                      selectedEntry.entry.id,
                      selectedEntry.entry.name
                    )}
                  </View>
                )}
              </View>

              {/* Streaks & Activity */}
              <Text style={styles.detailSectionLabel}>STREAKS & ACTIVITY</Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailStatBox}>
                  <Text style={styles.detailStatValue}>
                    🔥 {selectedEntry.entry.verifiedCurrentStreak}
                  </Text>
                  <Text style={styles.detailStatLabel}>
                    Verified Streak (Best {selectedEntry.entry.verifiedBestStreak})
                  </Text>
                </View>
                <View style={styles.detailStatBox}>
                  <Text style={styles.detailStatValue}>
                    ⚡ {selectedEntry.entry.personalCurrentStreak}
                  </Text>
                  <Text style={styles.detailStatLabel}>
                    Personal Streak (Best {selectedEntry.entry.personalBestStreak})
                  </Text>
                </View>
                <View style={styles.detailStatBox}>
                  <Text style={styles.detailStatValue}>
                    ⏱️ {formatGymTime(selectedEntry.entry.totalGymTimeMinutes)}
                  </Text>
                  <Text style={styles.detailStatLabel}>Total Gym Time</Text>
                </View>
                <View style={styles.detailStatBox}>
                  <Text style={styles.detailStatValue}>
                    📅 {selectedEntry.entry.workoutsCount}
                  </Text>
                  <Text style={styles.detailStatLabel}>Total Workouts</Text>
                </View>
              </View>

              {/* Strength PRs */}
              <Text style={styles.detailSectionLabel}>
                STRENGTH PRS ({weightUnit.toUpperCase()})
              </Text>
              <View style={styles.detailPrRow}>
                <View style={styles.detailPrBox}>
                  <Text style={styles.detailPrValue}>
                    {formatWeightWithUnit(selectedEntry.entry.squatPrKg, weightUnit)}
                  </Text>
                  <Text style={styles.detailPrLabel}>Squat</Text>
                </View>
                <View style={styles.detailPrBox}>
                  <Text style={styles.detailPrValue}>
                    {formatWeightWithUnit(selectedEntry.entry.benchPrKg, weightUnit)}
                  </Text>
                  <Text style={styles.detailPrLabel}>Bench</Text>
                </View>
                <View style={styles.detailPrBox}>
                  <Text style={styles.detailPrValue}>
                    {formatWeightWithUnit(selectedEntry.entry.deadliftPrKg, weightUnit)}
                  </Text>
                  <Text style={styles.detailPrLabel}>Deadlift</Text>
                </View>
                <View style={[styles.detailPrBox, styles.detailPrTotalBox]}>
                  <Text style={[styles.detailPrValue, { color: theme.primaryLight }]}>
                    {formatWeightWithUnit(selectedEntry.entry.totalPrKg, weightUnit)}
                  </Text>
                  <Text style={styles.detailPrLabel}>Total</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
  },
  categoryBar: {
    flexDirection: 'row',
    backgroundColor: theme.cardBackground,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 4,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  categoryTabActive: {
    backgroundColor: theme.primary,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  categoryTabTextActive: {
    color: theme.onPrimary,
  },
  tabNotifDot: {
    backgroundColor: theme.warning,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabNotifDotText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.background,
  },
  filterSection: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  moreBtnActive: {
    backgroundColor: theme.primaryMuted,
    borderColor: theme.primary,
  },
  moreBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  moreBtnTextActive: {
    color: theme.primaryLight,
  },
  filterHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textTertiary,
    letterSpacing: 1,
  },
  filterWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: theme.cardBackground,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  filterChipActive: {
    backgroundColor: theme.primaryMuted,
    borderColor: theme.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  filterChipTextActive: {
    color: theme.primaryLight,
  },
  contextBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  contextSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: theme.cardBackgroundSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  customGymNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.warningMuted,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  customGymNoticeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: theme.warning,
    lineHeight: 15,
  },
  friendsHeaderContainer: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    gap: 10,
  },
  yourTagBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  yourTagLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yourTagLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  yourTagValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  yourTagValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.primaryLight,
  },
  searchCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  searchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.inputBorder,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 14,
    color: theme.textPrimary,
  },
  searchResultsBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
    paddingTop: 8,
    gap: 8,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  searchResultSub: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  searchEmptyText: {
    fontSize: 12,
    color: theme.textTertiary,
    textAlign: 'center',
    paddingVertical: 6,
  },
  requestsCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    gap: 10,
  },
  requestsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requestsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.warning,
  },
  requestItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.cardBackgroundSubtle,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  requestUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  requestUserSub: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  requestActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  declineBtn: {
    backgroundColor: theme.inputBackground,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.inputBorder,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 10,
  },
  currentUserCard: {
    borderColor: theme.primaryBorder,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.cardBackgroundSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  firstRankBadge: {
    backgroundColor: theme.warningMuted,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.textSecondary,
  },
  firstRankText: {
    color: theme.warning,
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.textPrimary,
    flexShrink: 1,
  },
  userTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textTertiary,
  },
  youBadge: {
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.primaryLight,
    letterSpacing: 0.5,
  },
  friendStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.successMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  friendStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.successLight,
  },
  addFriendQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  addFriendQuickBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  pendingQuickBadge: {
    backgroundColor: theme.cardBackgroundSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  pendingQuickBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textTertiary,
  },
  acceptQuickBtn: {
    backgroundColor: theme.success,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  acceptQuickBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gymSubtitle: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 1,
  },
  miniStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 5,
  },
  miniStatPill: {
    backgroundColor: theme.cardBackgroundSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  miniStatPillActive: {
    borderColor: theme.primaryBorder,
    backgroundColor: theme.primaryMuted,
  },
  miniStatText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  metricColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textTertiary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.cardBackground,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  modalToggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 6,
  },
  modalToggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  modalToggleBtnActive: {
    backgroundColor: theme.primary,
  },
  modalToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  modalToggleTextActive: {
    color: theme.onPrimary,
  },
  modalAgeSection: {
    marginTop: 14,
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  modalResetText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  modalDoneBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.primary,
  },
  modalDoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.onPrimary,
  },
  detailModalCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
    flexShrink: 1,
  },
  detailGymText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  detailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  detailMetaPill: {
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  detailMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.textTertiary,
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailStatBox: {
    width: '48.5%',
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  detailStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  detailStatLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 3,
  },
  detailPrRow: {
    flexDirection: 'row',
    gap: 6,
  },
  detailPrBox: {
    flex: 1,
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  detailPrTotalBox: {
    borderColor: theme.primaryBorder,
    backgroundColor: theme.primaryMuted,
  },
  detailPrValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  detailPrLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 2,
  },
  pinnedRankBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pinnedRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pinnedRankBadge: {
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pinnedRankBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.primaryLight,
  },
  pinnedRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  pinnedRankRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinnedRankMetric: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.primaryLight,
  },
});
