import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StreakState } from '../types/fitness';
import { AppTheme } from '../constants/theme';
import { useFitness } from '../context/FitnessContext';
import { STREAK_LOST_MESSAGE } from '../services/streakManager';

interface StreakCardProps {
  streakState: StreakState;
  weeklyGoal: number;
  isVerifiedGym?: boolean;
}

export const StreakCard: React.FC<StreakCardProps> = ({
  streakState,
  weeklyGoal,
  isVerifiedGym,
}) => {
  const { theme } = useFitness();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isAtRisk = streakState.streakStatus === 'at_risk';
  const isReset = streakState.streakStatus === 'reset';
  const verifiedStreak = streakState.verifiedStreak ?? 0;
  const showSplitBreakdown =
    verifiedStreak !== streakState.currentStreak || isVerifiedGym === false;

  return (
    <View style={[styles.container, isReset && styles.containerReset, isAtRisk && styles.containerAtRisk]}>
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.iconCircle,
              isReset ? styles.iconCircleReset : isAtRisk ? styles.iconCircleAtRisk : styles.iconCircleActive,
            ]}
          >
            <Ionicons
              name={isReset ? 'flame-outline' : streakState.currentStreak > 0 ? 'flame' : 'flame-outline'}
              size={36}
              color={isReset ? theme.danger : isAtRisk ? theme.warning : theme.flame}
            />
          </View>
          <View>
            <Text style={styles.label}>
              {showSplitBreakdown ? 'PERSONAL STREAK' : 'VISIT STREAK'}
            </Text>
            <Text style={styles.streakCount}>
              {streakState.currentStreak} <Text style={styles.streakUnit}>Workouts</Text>
            </Text>
          </View>
        </View>

        <View style={styles.bestBadge}>
          <Text style={styles.bestLabel}>BEST</Text>
          <Text style={styles.bestValue}>{streakState.bestStreak} 🔥</Text>
        </View>
      </View>

      {/* Split Breakdown (Only shown when Personal & Verified streaks differ or on a Custom Gym) */}
      {showSplitBreakdown && (
        <View style={styles.splitRow}>
          <View style={styles.splitPill}>
            <Text style={styles.splitLabel}>Personal (Friends)</Text>
            <Text style={styles.splitValue}>{streakState.currentStreak} 🔥</Text>
          </View>
          <View style={styles.splitPill}>
            <Text style={styles.splitLabel}>Verified Gym (Global)</Text>
            <Text style={styles.splitValue}>{verifiedStreak} 🏟️</Text>
          </View>
        </View>
      )}

      {/* Status Banner */}
      <View style={styles.statusContainer}>
        {isReset ? (
          <View style={styles.statusBadgeReset}>
            <Ionicons name="close-circle" size={18} color={theme.danger} />
            <Text style={styles.statusTextReset}>
              {streakState.statusMessage || STREAK_LOST_MESSAGE}
            </Text>
          </View>
        ) : isAtRisk ? (
          <View style={styles.statusBadgeWarning}>
            <Ionicons name="warning" size={18} color={theme.warning} />
            <Text style={styles.statusTextWarning}>
              Streak at risk! You must hit {weeklyGoal} workouts this week to keep it alive.
            </Text>
          </View>
        ) : (
          <View style={styles.statusBadgeActive}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
            <Text style={styles.statusTextActive}>
              Streak active! Keep going to maintain your momentum.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  containerReset: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  containerAtRisk: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleActive: {
    backgroundColor: theme.flameMuted,
  },
  iconCircleAtRisk: {
    backgroundColor: theme.warningMuted,
  },
  iconCircleReset: {
    backgroundColor: theme.dangerMuted,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.textSecondary,
  },
  streakCount: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.textPrimary,
  },
  streakUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  splitPill: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundSubtle,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  splitLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  splitValue: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  bestBadge: {
    alignItems: 'flex-end',
    backgroundColor: theme.cardBackgroundSubtle,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  bestLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textTertiary,
  },
  bestValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 2,
  },
  statusContainer: {
    marginTop: 16,
  },
  statusBadgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.successMuted,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.successLight,
    flex: 1,
  },
  statusBadgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.warningMuted,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusTextWarning: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.warning,
    flex: 1,
  },
  statusBadgeReset: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.dangerMuted,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusTextReset: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F87171',
    flex: 1,
    lineHeight: 18,
  },
});
