import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { WorkoutSession } from '../types/fitness';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';
import { AppTheme } from '../constants/theme';
import { useFitness } from '../context/FitnessContext';

interface WorkoutContributionGraphProps {
  workouts: WorkoutSession[];
  weeksCount?: number;
}

interface DayCell {
  dateStr: string;
  dateObj: Date;
  minutes: number;
  gymName?: string;
  isFuture: boolean;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function getCellColor(minutes: number, isFuture: boolean, theme: AppTheme): string {
  if (isFuture) return 'transparent';
  if (minutes <= 0) return theme.cardBackgroundSubtle;
  if (minutes < 30) return 'rgba(16, 185, 129, 0.30)';
  if (minutes < 60) return 'rgba(16, 185, 129, 0.55)';
  if (minutes < 90) return 'rgba(16, 185, 129, 0.80)';
  return theme.successLight;
}

function formatTotalTime(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export const WorkoutContributionGraph: React.FC<WorkoutContributionGraphProps> = ({
  workouts,
  weeksCount = 16,
}) => {
  const { theme } = useFitness();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null);

  const { weeks, monthLabels, activeDaysCount, totalMinutesInWindow } = useMemo(() => {
    // Map YYYY-MM-DD -> cumulative gym minutes & gym name
    const dayMap = new Map<string, { minutes: number; gymName: string }>();
    for (const w of workouts) {
      const existing = dayMap.get(w.dateString);
      const mins = w.durationMinutes || 0;
      if (existing) {
        existing.minutes += mins;
      } else {
        dayMap.set(w.dateString, { minutes: mins, gymName: w.gymName });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateToYYYYMMDD(today);

    // Find Monday of the current week (Mon = 0, ..., Sun = 6)
    const jsDay = today.getDay();
    const offsetToMonday = jsDay === 0 ? -6 : 1 - jsDay;
    const currentWeekMonday = new Date(today);
    currentWeekMonday.setDate(today.getDate() + offsetToMonday);

    // Start (weeksCount - 1) weeks before currentWeekMonday
    const startMonday = new Date(currentWeekMonday);
    startMonday.setDate(currentWeekMonday.getDate() - (weeksCount - 1) * 7);

    const builtWeeks: DayCell[][] = [];
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    let activeDays = 0;
    let totalMins = 0;

    for (let w = 0; w < weeksCount; w++) {
      const col: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startMonday);
        cellDate.setDate(startMonday.getDate() + w * 7 + d);
        const dateStr = formatDateToYYYYMMDD(cellDate);
        const isFuture = cellDate.getTime() > today.getTime() && dateStr !== todayStr;
        const entry = dayMap.get(dateStr);
        const minutes = isFuture ? 0 : entry?.minutes ?? 0;

        if (!isFuture && minutes > 0) {
          activeDays += 1;
          totalMins += minutes;
        }

        if (d === 0) {
          const month = cellDate.getMonth();
          if (month !== lastMonth) {
            labels.push({ weekIndex: w, label: MONTH_NAMES[month] });
            lastMonth = month;
          }
        }

        col.push({
          dateStr,
          dateObj: cellDate,
          minutes,
          gymName: entry?.gymName,
          isFuture,
        });
      }
      builtWeeks.push(col);
    }

    return {
      weeks: builtWeeks,
      monthLabels: labels,
      activeDaysCount: activeDays,
      totalMinutesInWindow: totalMins,
    };
  }, [workouts, weeksCount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const monthByWeek = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of monthLabels) {
      map.set(item.weekIndex, item.label);
    }
    return map;
  }, [monthLabels]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Gym Activity</Text>
          <Text style={styles.subtitle}>
            {activeDaysCount} {activeDaysCount === 1 ? 'day' : 'days'} •{' '}
            {formatTotalTime(totalMinutesInWindow)} in last {weeksCount} wks
          </Text>
        </View>

        {selectedDay && !selectedDay.isFuture && (
          <View style={styles.selectedPill}>
            <Text style={styles.selectedPillText}>
              {selectedDay.dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
              {selectedDay.minutes > 0
                ? ` • ${selectedDay.minutes}m`
                : ' • Rest'}
            </Text>
          </View>
        )}
      </View>

      {/* Contribution Grid */}
      <View style={styles.gridWrapper}>
        {/* Weekday Labels */}
        <View style={styles.dayLabelsCol}>
          <Text style={styles.dayLabelSpacer} />
          <Text style={styles.dayLabel}>Mon</Text>
          <Text style={styles.dayLabel} />
          <Text style={styles.dayLabel}>Wed</Text>
          <Text style={styles.dayLabel} />
          <Text style={styles.dayLabel}>Fri</Text>
          <Text style={styles.dayLabel} />
          <Text style={styles.dayLabel} />
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {weeks.map((week, wIdx) => (
            <View key={wIdx} style={styles.weekCol}>
              <Text style={styles.monthLabel}>{monthByWeek.get(wIdx) || ''}</Text>
              {week.map((day) => {
                const isSelected = selectedDay?.dateStr === day.dateStr;
                return (
                  <TouchableOpacity
                    key={day.dateStr}
                    disabled={day.isFuture}
                    onPress={() => setSelectedDay(day)}
                    activeOpacity={0.75}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: getCellColor(day.minutes, day.isFuture, theme),
                        borderColor: day.isFuture
                          ? 'transparent'
                          : isSelected
                          ? theme.primaryLight
                          : theme.cardBorder,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendHint}>Tap a day to inspect gym time</Text>
        <View style={styles.legendScale}>
          <Text style={styles.legendText}>Less</Text>
          <View style={[styles.legendCell, { backgroundColor: theme.cardBackgroundSubtle }]} />
          <View style={[styles.legendCell, { backgroundColor: 'rgba(16, 185, 129, 0.30)' }]} />
          <View style={[styles.legendCell, { backgroundColor: 'rgba(16, 185, 129, 0.55)' }]} />
          <View style={[styles.legendCell, { backgroundColor: 'rgba(16, 185, 129, 0.80)' }]} />
          <View style={[styles.legendCell, { backgroundColor: theme.successLight }]} />
          <Text style={styles.legendText}>More</Text>
        </View>
      </View>
    </View>
  );
};

const CELL_SIZE = 14;
const CELL_GAP = 4;

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  selectedPill: {
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  selectedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  gridWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dayLabelsCol: {
    marginRight: 6,
    gap: CELL_GAP,
  },
  dayLabelSpacer: {
    height: 14,
    marginBottom: 2,
  },
  dayLabel: {
    height: CELL_SIZE,
    lineHeight: CELL_SIZE,
    fontSize: 9,
    fontWeight: '600',
    color: theme.textTertiary,
  },
  scrollContent: {
    gap: CELL_GAP,
    paddingRight: 4,
  },
  weekCol: {
    gap: CELL_GAP,
    alignItems: 'center',
  },
  monthLabel: {
    height: 14,
    fontSize: 9,
    fontWeight: '700',
    color: theme.textTertiary,
    marginBottom: 2,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
    borderWidth: 1,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
  },
  legendHint: {
    fontSize: 10,
    color: theme.textTertiary,
  },
  legendScale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendText: {
    fontSize: 9,
    color: theme.textTertiary,
    marginHorizontal: 2,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
});
