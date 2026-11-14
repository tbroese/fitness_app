import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GymLocation, DwellSessionState, FIXED_DWELL_MINUTES } from '../types/fitness';
import { theme } from '../constants/theme';

interface GymStatusCardProps {
  gym: GymLocation | null;
  dwellState: DwellSessionState;
  distanceMeters: number | null;
  onRefreshLocation: () => void;
  onOpenGymSettings: () => void;
}

export const GymStatusCard: React.FC<GymStatusCardProps> = ({
  gym,
  dwellState,
  distanceMeters,
  onRefreshLocation,
  onOpenGymSettings,
}) => {
  const isInside = distanceMeters !== null && gym !== null && distanceMeters <= gym.radiusMeters;
  const dwellRequired = FIXED_DWELL_MINUTES;
  const dwellPercent = Math.min(
    100,
    Math.round((dwellState.minutesDwelling / dwellRequired) * 100)
  );

  if (!gym) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyContainer}>
          <Ionicons name="location-outline" size={40} color={theme.textTertiary} />
          <Text style={styles.emptyTitle}>No Gym Configured</Text>
          <Text style={styles.emptySub}>
            Set your gym location so the app can automatically detect workouts and track streaks.
          </Text>
          <TouchableOpacity style={styles.setupBtn} onPress={onOpenGymSettings}>
            <Text style={styles.setupBtnText}>Configure Gym Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.gymInfo}>
          <View style={styles.gymIcon}>
            <Ionicons name="barbell" size={20} color={theme.primaryLight} />
          </View>
          <View>
            <Text style={styles.gymName}>{gym.name}</Text>
            <Text style={styles.radiusText}>
              Automatic GPS verification • {dwellRequired} mins stay required
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onOpenGymSettings} style={styles.editBtn}>
          <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Proximity / Location State */}
      <View style={styles.proximityRow}>
        <View
          style={[
            styles.statusDot,
            isInside ? styles.statusDotInside : styles.statusDotOutside,
          ]}
        />
        <Text style={styles.distanceText}>
          {distanceMeters !== null
            ? isInside
              ? `Inside gym perimeter (${distanceMeters}m)`
              : `${distanceMeters > 1000 ? (distanceMeters / 1000).toFixed(1) + ' km' : distanceMeters + 'm'} away`
            : 'Locating GPS...'}
        </Text>
        <TouchableOpacity onPress={onRefreshLocation} style={styles.refreshIcon}>
          <Ionicons name="refresh" size={16} color={theme.primaryLight} />
        </TouchableOpacity>
      </View>

      {/* Dwell Timer / In-Progress Workout */}
      {dwellState.completedToday && dwellState.isDwelling ? (
        <View style={styles.completedBanner}>
          <Ionicons name="checkmark-done-circle" size={24} color={theme.success} />
          <View style={{ flex: 1 }}>
            <View style={styles.completedHeaderRow}>
              <Text style={styles.completedTitle}>Workout Verified!</Text>
              <Text style={styles.liveSessionBadge}>{dwellState.minutesDwelling} mins</Text>
            </View>
            <Text style={styles.completedSub}>
              15-min goal reached. Continuing to track your gym time while you stay!
            </Text>
          </View>
        </View>
      ) : dwellState.completedToday ? (
        <View style={styles.completedBanner}>
          <Ionicons name="checkmark-done-circle" size={24} color={theme.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.completedTitle}>Workout Completed Today!</Text>
            <Text style={styles.completedSub}>
              Total time in gym today: {Math.max(dwellRequired, dwellState.minutesDwelling)} mins. Your streak has been updated!
            </Text>
          </View>
        </View>
      ) : dwellState.isDwelling ? (
        <View style={styles.dwellBox}>
          <View style={styles.dwellHeader}>
            <Text style={styles.dwellTitle}>Workout in Progress</Text>
            <Text style={styles.dwellTime}>
              {dwellState.minutesDwelling} / {dwellRequired} mins
            </Text>
          </View>
          <View style={styles.dwellProgressBg}>
            <View style={[styles.dwellProgressFill, { width: `${dwellPercent}%` }]} />
          </View>
          <Text style={styles.dwellSub}>
            Remain at gym for {Math.max(0, dwellRequired - dwellState.minutesDwelling)} more mins to automatically log your workout.
          </Text>
        </View>
      ) : (
        <View style={styles.dwellBoxIdle}>
          <Ionicons name="hourglass-outline" size={18} color={theme.textTertiary} />
          <Text style={styles.dwellIdleText}>
            Requires staying inside the gym for {dwellRequired} mins. Logging is fully automatic via GPS.
          </Text>
        </View>
      )}
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  setupBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  setupBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gymInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gymIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gymName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  radiusText: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    padding: 8,
  },
  proximityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotInside: {
    backgroundColor: theme.success,
  },
  statusDotOutside: {
    backgroundColor: theme.warning,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  refreshIcon: {
    padding: 4,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.successMuted,
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  completedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.successLight,
  },
  liveSessionBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.successLight,
  },
  completedSub: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  dwellBox: {
    backgroundColor: theme.primaryMuted,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  dwellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dwellTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  dwellTime: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  dwellProgressBg: {
    height: 8,
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 8,
  },
  dwellProgressFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 4,
  },
  dwellSub: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  dwellBoxIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  dwellIdleText: {
    fontSize: 12,
    color: theme.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
});
