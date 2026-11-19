import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import { WorkoutContributionGraph } from '../../components/WorkoutContributionGraph';
import { WorkoutSession } from '../../types/fitness';
import { formatGymDuration } from '../../utils/dateUtils';
import { AppTheme } from '../../constants/theme';

export default function HistoryScreen() {
  const { workouts, streakState, theme } = useFitness();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderWorkoutItem = ({ item }: { item: WorkoutSession }) => {
    const dateObj = new Date(item.timestamp);
    const dateStr = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.workoutCard}>
        <View style={styles.iconContainer}>
          <Ionicons name="barbell" size={20} color={theme.primaryLight} />
        </View>

        <View style={styles.details}>
          <View style={styles.rowBetween}>
            <Text style={styles.gymName}>{item.gymName}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={theme.success} />
              <Text style={styles.verifiedText}>GPS Verified</Text>
            </View>
          </View>

          <Text style={styles.dateTime}>
            {dateStr} • {timeStr}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={12} color={theme.textTertiary} />
              <Text style={styles.metaText}>{formatGymDuration(item.durationMinutes)}</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="calendar-outline" size={12} color={theme.textTertiary} />
              <Text style={styles.metaText}>{item.weekId}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        {/* Summary stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{workouts.length}</Text>
            <Text style={styles.statLabel}>Total Workouts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streakState.currentStreak} 🔥</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streakState.bestStreak} 🏆</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
        </View>

        {/* GitHub-style Contribution Graph */}
        <WorkoutContributionGraph workouts={workouts} />

        {/* Workout List */}
        {workouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="barbell-outline" size={54} color={theme.textTertiary} />
            <Text style={styles.emptyTitle}>No Workouts Logged Yet</Text>
            <Text style={styles.emptySubtitle}>
              When you arrive at your gym and stay for your workout, check-ins will automatically appear here!
            </Text>
          </View>
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            renderItem={renderWorkoutItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
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
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 14,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  workoutCard: {
    flexDirection: 'row',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    gap: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gymName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.successMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.successLight,
  },
  dateTime: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.cardBackgroundSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  metaText: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
