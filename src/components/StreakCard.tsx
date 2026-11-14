import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StreakState } from '../types/fitness';

interface StreakCardProps {
  streakState: StreakState;
  weeklyGoal: number;
}

export const StreakCard: React.FC<StreakCardProps> = ({ streakState, weeklyGoal }) => {
  const isAtRisk = streakState.streakStatus === 'at_risk';
  const isReset = streakState.streakStatus === 'reset';

  return (
    <View style={[styles.container, isAtRisk && styles.containerAtRisk]}>
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          <View style={[styles.iconCircle, isAtRisk && styles.iconCircleAtRisk]}>
            <Ionicons
              name={streakState.currentStreak > 0 ? 'flame' : 'flame-outline'}
              size={36}
              color={isAtRisk ? '#FF9800' : '#FF5722'}
            />
          </View>
          <View>
            <Text style={styles.label}>VISIT STREAK</Text>
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

      {/* Status Banner */}
      <View style={styles.statusContainer}>
        {isAtRisk ? (
          <View style={styles.statusBadgeWarning}>
            <Ionicons name="warning" size={16} color="#E65100" />
            <Text style={styles.statusTextWarning}>
              Streak at risk! You must hit {weeklyGoal} workouts this week to keep it alive.
            </Text>
          </View>
        ) : isReset ? (
          <View style={styles.statusBadgeReset}>
            <Ionicons name="refresh-circle" size={16} color="#757575" />
            <Text style={styles.statusTextReset}>
              Streak reset. Reach {weeklyGoal} workouts this week to start a new streak!
            </Text>
          </View>
        ) : (
          <View style={styles.statusBadgeActive}>
            <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
            <Text style={styles.statusTextActive}>
              Streak active! Keep going to maintain your momentum.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  containerAtRisk: {
    borderColor: '#FFE0B2',
    backgroundColor: '#FFFDF9',
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
    backgroundColor: '#FFECE0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleAtRisk: {
    backgroundColor: '#FFF3E0',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#8E8E93',
  },
  streakCount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  streakUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  bestBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#F2F2F7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  bestLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
  },
  bestValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 2,
  },
  statusContainer: {
    marginTop: 16,
  },
  statusBadgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  statusTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    flex: 1,
  },
  statusBadgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  statusTextWarning: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
    flex: 1,
  },
  statusBadgeReset: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  statusTextReset: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
    flex: 1,
  },
});
