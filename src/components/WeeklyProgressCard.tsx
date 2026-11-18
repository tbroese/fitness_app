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
  getIsoWeekId,
} from '../utils/dateUtils';

interface WeeklyProgressCardProps {
  weeklyGoal: number;
  currentWeekWorkouts: number;
  workouts: WorkoutSession[];
  isReset?: boolean;
  isPartneredGym?: boolean;
}

export const WeeklyProgressCard: React.FC<WeeklyProgressCardProps> = ({
  weeklyGoal,
  currentWeekWorkouts,
  workouts,
  isReset = false,
  isPartneredGym = false,
}) => {
  const { start } = getWeekStartAndEnd(new Date());
  const daysRemaining = getDaysRemainingInWeek(new Date());
  const progressPercent = Math.min(100, Math.round((currentWeekWorkouts / weeklyGoal) * 100));
  const needed = Math.max(0, weeklyGoal - currentWeekWorkouts);
  const currentWeekId = getIsoWeekId(new Date());
  const currentWeekCustomCount = workouts.filter(
    (w) => w.weekId === currentWeekId && !w.isPartnered
  ).length;
  const currentWeekPartnerCount = workouts.filter(
    (w) => w.weekId === currentWeekId && Boolean(w.isPartnered)
  ).length;
  const partnerPercent = Math.min(100, (currentWeekPartnerCount / weeklyGoal) * 100);
  const customPercent = Math.min(100 - partnerPercent, (currentWeekCustomCount / weeklyGoal) * 100);

  // Generate 7 days for current week (Mon-Sun)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = formatDateToYYYYMMDD(d);
    const dayWorkout = workouts.find((w) => w.dateString === dateStr);
    const hasWorkout = Boolean(dayWorkout);
    const isPartneredWorkout = Boolean(dayWorkout?.isPartnered);
    const isToday = dateStr === formatDateToYYYYMMDD(new Date());

    return {
      name: getDayAbbreviation(i),
      hasWorkout,
      isPartneredWorkout,
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
        {isReset ? (
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: theme.danger,
              },
            ]}
          />
        ) : (
          <>
            {partnerPercent > 0 && (
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${partnerPercent}%`,
                    backgroundColor: theme.success,
                    borderRadius: 0,
                  },
                ]}
              />
            )}
            {customPercent > 0 && (
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${customPercent}%`,
                    backgroundColor: theme.primary,
                    borderRadius: 0,
                  },
                ]}
              />
            )}
          </>
        )}
      </View>

      {/* Week Day Pills */}
      <View style={styles.daysRow}>
        {weekDays.map((item, idx) => (
          <View key={idx} style={styles.dayCol}>
            <Text style={[styles.dayText, item.isToday && styles.dayTextToday]}>
              {item.name}
            </Text>
            <View
              style={[
                styles.dayCircle,
                item.hasWorkout &&
                  (item.isPartneredWorkout
                    ? styles.dayCircleCompleted
                    : styles.dayCircleCompletedCustom),
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

      {/* Mixed custom/partnered note when custom workouts were logged this week */}
      {currentWeekCustomCount > 0 && (
        <Text style={styles.customNoteText}>
          {currentWeekPartnerCount}/{weeklyGoal} partnered gym visits • {currentWeekCustomCount} custom (Personal & Friends)
        </Text>
      )}

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
    borderColor: theme.primaryBorder,
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
    flexDirection: 'row',
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
    backgroundColor: theme.brandRed,
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
  dayCircleCompletedCustom: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
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
  customNoteText: {
    fontSize: 11,
    color: theme.primaryLight,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
});
