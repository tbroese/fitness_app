import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSession } from '../types/fitness';
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
}

export const WeeklyProgressCard: React.FC<WeeklyProgressCardProps> = ({
  weeklyGoal,
  currentWeekWorkouts,
  workouts,
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
            {needed === 0
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
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
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
        <Ionicons name="time-outline" size={14} color="#8E8E93" />
        <Text style={styles.footerText}>
          {daysRemaining === 0 ? 'Last day of the week!' : `${daysRemaining} days remaining in this week`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
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
    color: '#1C1C1E',
  },
  subTitle: {
    fontSize: 13,
    color: '#636366',
    marginTop: 4,
    maxWidth: 220,
  },
  fractionBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#007AFF12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  fractionCurrent: {
    fontSize: 22,
    fontWeight: '800',
    color: '#007AFF',
  },
  fractionTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#E5E5EA',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
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
    color: '#8E8E93',
  },
  dayTextToday: {
    color: '#007AFF',
    fontWeight: '800',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  dayCircleCompleted: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  dayCircleToday: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  dayNumberToday: {
    color: '#007AFF',
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  footerText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
});
