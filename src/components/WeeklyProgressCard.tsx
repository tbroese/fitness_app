import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSession } from '../types/fitness';
import { theme } from '../constants/theme';
import {
  getWeekStartAndEnd,
  formatDateToYYYYMMDD,
  getDayAbbreviation,
  getDaysRemainingInWeek,
} from '../utils/dateUtils';

interface WeeklyProgressCardProps {
  weeklyGoal: number;
  currentWeekWorkouts: number;
  workouts: WorkoutSession[];
  isReset?: boolean;
}

export const WeeklyProgressCard: React.FC<WeeklyProgressCardProps> = ({
  weeklyGoal,
  currentWeekWorkouts,
  workouts,
  isReset = false,
}) => {
  const { start } = getWeekStartAndEnd(new Date());
  const daysRemaining = getDaysRemainingInWeek(new Date());
  const progressPercent = Math.min(100, Math.round((currentWeekWorkouts / weeklyGoal) * 100));
  const needed = Math.max(0, weeklyGoal - currentWeekWorkouts);

  // Generate 7 days for current week (Mon-Sun)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = formatDateToYYYYMMDD(d);
    const hasWorkout = workouts.some((w) => w.dateString === dateStr);
    const isToday = dateStr === formatDateToYYYYMMDD(new Date());

    return {
      name: getDayAbbreviation(i),
      hasWorkout,
      isToday,
      dayNum: d.getDate(),
    };
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Weekly Target</Text>
          <Text style={styles.subTitle}>
            {isReset
              ? 'Streak lost for this week. Goal restarts next week.'
              : needed === 0
              ? '🎉 Goal achieved for this week!'
              : `${needed} more workout${needed > 1 ? 's' : ''} needed to avoid streak reset`}
          </Text>
        </View>
        <View style={styles.fractionBox}>
          <Text style={styles.fractionCurrent}>{currentWeekWorkouts}</Text>
          <Text style={styles.fractionTotal}>/{weeklyGoal}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progressPercent}%` },
            isReset && { backgroundColor: theme.danger },
          ]}
        />
      </View>

      {/* Week Day Pills */}
      <View style={styles.daysRow}>
        {weekDays.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.dayCol,
              item.isToday && styles.dayColToday,
              item.hasWorkout && styles.dayColCompleted,
            ]}
          >
            <Text style={[styles.dayText, item.isToday && styles.dayTextToday]}>
              {item.name}
            </Text>
            <View
              style={[
                styles.dayCircle,
                item.hasWorkout && styles.dayCircleCompleted,
                item.isToday && !item.hasWorkout && styles.dayCircleToday,
              ]}
            >
              {item.hasWorkout ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.dayNumber,
                    item.isToday && styles.dayNumberToday,
                  ]}
                >
                  {item.dayNum}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Days left footer */}
      <View style={styles.footerRow}>
        <Ionicons name="time-outline" size={14} color={theme.textTertiary} />
        <Text style={styles.footerText}>
          {daysRemaining === 0 ? 'Last day of the week!' : `${daysRemaining} days remaining in this week`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  subTitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
    maxWidth: 220,
    lineHeight: 18,
  },
  fractionBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  fractionCurrent: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.primaryLight,
  },
  fractionTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primaryLight,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 5,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayColToday: {},
  dayColCompleted: {},
  dayText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  dayTextToday: {
    color: theme.primaryLight,
    fontWeight: '800',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.cardBackgroundSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  dayCircleCompleted: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  dayCircleToday: {
    borderColor: theme.primaryLight,
    borderWidth: 2,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  dayNumberToday: {
    color: theme.primaryLight,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
  },
  footerText: {
    fontSize: 12,
    color: theme.textTertiary,
    fontWeight: '500',
  },
});
