import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import { RemoteLeaderboardUser } from '../../services/cloud';
import { theme } from '../../constants/theme';

type LeaderboardCategory = 'global' | 'gym' | 'friends';
type LeaderboardFilter = 'currentStreak' | 'bestStreak' | 'totalGymTime';

interface LeaderboardEntry {
  id: string;
  name: string;
  userTag: string;
  isCurrentUser: boolean;
  gymName: string;
  currentStreak: number;
  bestStreak: number;
  totalGymTimeMinutes: number;
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
  { key: 'totalGymTime', label: 'Total Gym Time', icon: 'time-outline' },
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
    sendFriendRequestToUser,
    respondToFriendRequest,
  } = useFitness();

  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategory>('global');
  const [selectedFilter, setSelectedFilter] = useState<LeaderboardFilter>('currentStreak');
  const [remoteUsers, setRemoteUsers] = useState<RemoteLeaderboardUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Friend search state
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RemoteLeaderboardUser[]>([]);
  const [searching, setSearching] = useState(false);

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

  const currentUserEntry: LeaderboardEntry = useMemo(
    () => ({
      id: userProfile.id || 'current-user',
      name: userProfile.fullName || 'You',
      userTag: userProfile.userTag || '4821',
      isCurrentUser: true,
      gymName: preferences.gymLocation?.name || 'No Gym Selected',
      currentStreak: streakState.currentStreak,
      bestStreak: streakState.bestStreak,
      totalGymTimeMinutes,
    }),
    [userProfile, preferences.gymLocation, streakState, totalGymTimeMinutes]
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
          if (!preferences.gymLocation?.name) return false;
          return (
            u.gymName.toLowerCase() === preferences.gymLocation.name.toLowerCase() ||
            (preferences.gymLocation.id && u.gymId === preferences.gymLocation.id)
          );
        }
        return true;
      })
      .map((u) => ({
        id: u.id,
        name: u.fullName || 'Athlete',
        userTag: u.userTag || '0000',
        isCurrentUser: false,
        gymName: u.gymName || 'No Gym Selected',
        currentStreak: u.currentStreak,
        bestStreak: u.bestStreak,
        totalGymTimeMinutes: u.totalGymTimeMinutes,
      }));

    const list = [currentUserEntry, ...otherEntries];
    list.sort((a, b) => {
      if (selectedFilter === 'currentStreak') {
        return b.currentStreak - a.currentStreak;
      }
      if (selectedFilter === 'bestStreak') {
        return b.bestStreak - a.bestStreak;
      }
      return b.totalGymTimeMinutes - a.totalGymTimeMinutes;
    });
    return list;
  }, [
    remoteUsers,
    friendships.friends,
    currentUserEntry,
    selectedCategory,
    selectedFilter,
    preferences.gymLocation,
  ]);

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
    return {
      value: formatGymTime(item.totalGymTimeMinutes),
      unit: `${item.totalGymTimeMinutes} mins total`,
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
      <View
        style={[
          styles.entryCard,
          item.isCurrentUser && styles.currentUserCard,
        ]}
      >
        {/* Rank Badge */}
        <View style={[styles.rankBadge, rank === 1 && styles.firstRankBadge]}>
          <Text style={[styles.rankText, rank === 1 && styles.firstRankText]}>
            #{rank}
          </Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={20} color={theme.primaryLight} />
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
          </View>
        </View>

        {/* Primary Highlighted Filter Metric */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>{metric.value}</Text>
          <Text style={styles.metricUnit}>{metric.unit}</Text>
        </View>
      </View>
    );
  };

  const renderFriendsHeader = () => {
    if (selectedCategory !== 'friends') return null;

    return (
      <View style={styles.friendsHeaderContainer}>
        {/* Your Shareable Tag Card */}
        <View style={styles.yourTagBar}>
          <View style={styles.yourTagLeft}>
            <Ionicons name="pricetag-outline" size={16} color={theme.primaryLight} />
            <Text style={styles.yourTagLabel}>Your Friend Tag:</Text>
          </View>
          <View style={styles.yourTagValueBadge}>
            <Text style={styles.yourTagValueText}>
              {userProfile.fullName || 'You'} #{userProfile.userTag || '4821'}
            </Text>
          </View>
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
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
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
                  color={active ? '#FFFFFF' : theme.textSecondary}
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

        {/* 2. Filter Pills: Current Streak | Best Streak | Total Gym Time */}
        <View style={styles.filterSection}>
          <Text style={styles.filterHeaderLabel}>SORT BY</Text>
          <View style={styles.filterRow}>
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

        {/* Leaderboard List */}
        <FlatList
          data={entries}
          keyExtractor={(item) => `${selectedCategory}-${item.id}`}
          renderItem={renderLeaderboardItem}
          ListHeaderComponent={renderFriendsHeader}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primaryLight}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    color: '#FFFFFF',
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
    color: '#0B0F19',
  },
  filterSection: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  filterHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textTertiary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: theme.cardBackground,
    paddingVertical: 9,
    paddingHorizontal: 8,
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
  friendsHeaderContainer: {
    marginBottom: 12,
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
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 12,
  },
  currentUserCard: {
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    fontSize: 13,
    fontWeight: '800',
    color: theme.textSecondary,
  },
  firstRankText: {
    color: theme.warning,
  },
  avatarContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
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
    borderColor: 'rgba(59, 130, 246, 0.4)',
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
    borderColor: 'rgba(59, 130, 246, 0.35)',
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
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  miniStatsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  miniStatPill: {
    backgroundColor: theme.cardBackgroundSubtle,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  miniStatPillActive: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
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
    fontSize: 17,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textTertiary,
    marginTop: 2,
  },
});
