import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
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
    syncToCloud,
    fetchLeaderboardEntries,
  } = useFitness();

  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategory>('global');
  const [selectedFilter, setSelectedFilter] = useState<LeaderboardFilter>('currentStreak');
  const [remoteUsers, setRemoteUsers] = useState<RemoteLeaderboardUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    if (!isCloudConfigured) {
      setRemoteUsers([]);
      return;
    }
    try {
      await syncToCloud();
      const fetched = await fetchLeaderboardEntries(selectedCategory);
      setRemoteUsers(fetched);
    } catch (e) {
      console.warn('Failed to load remote leaderboard:', e);
    }
  }, [isCloudConfigured, syncToCloud, fetchLeaderboardEntries, selectedCategory]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const totalGymTimeMinutes = useMemo(
    () => workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0),
    [workouts]
  );

  const currentUserEntry: LeaderboardEntry = useMemo(
    () => ({
      id: userProfile.id || 'current-user',
      name: userProfile.fullName || 'You',
      isCurrentUser: true,
      gymName: preferences.gymLocation?.name || 'No Gym Selected',
      currentStreak: streakState.currentStreak,
      bestStreak: streakState.bestStreak,
      totalGymTimeMinutes,
    }),
    [userProfile, preferences.gymLocation, streakState, totalGymTimeMinutes]
  );

  // Merge remote users with the current user's live data and sort by the active filter
  const entries = useMemo(() => {
    const otherEntries: LeaderboardEntry[] = remoteUsers
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
  }, [remoteUsers, currentUserEntry, selectedCategory, selectedFilter, preferences.gymLocation]);

  const getCategorySubtitle = (): string => {
    if (selectedCategory === 'global') {
      return 'Worldwide rankings across all athletes';
    }
    if (selectedCategory === 'gym') {
      return preferences.gymLocation?.name
        ? `Members training at ${preferences.gymLocation.name}`
        : 'Members at your home gym';
    }
    return 'Rankings among your added friends';
  };

  const renderMetricDisplay = (item: LeaderboardEntry) => {
    if (selectedFilter === 'currentStreak') {
      return {
        value: `${item.currentStreak} 🔥`,
        unit: item.currentStreak === 1 ? 'visit streak' : 'visit streak',
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
            {item.isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        {/* 1. Subcategory Tabs: Global | Gym | Friends */}
        <View style={styles.categoryBar}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.key;
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
          contentContainerStyle={styles.listContent}
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
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.textPrimary,
    flexShrink: 1,
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
