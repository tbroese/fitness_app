import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GymLocation, DwellSessionState } from '../types/fitness';

interface GymStatusCardProps {
  gym: GymLocation | null;
  dwellState: DwellSessionState;
  distanceMeters: number | null;
  onRefreshLocation: () => void;
  onManualCheckIn: () => { success: boolean; message: string };
  onOpenGymSettings: () => void;
}

export const GymStatusCard: React.FC<GymStatusCardProps> = ({
  gym,
  dwellState,
  distanceMeters,
  onRefreshLocation,
  onManualCheckIn,
  onOpenGymSettings,
}) => {
  const isInside = distanceMeters !== null && gym !== null && distanceMeters <= gym.radiusMeters;
  const dwellRequired = gym?.dwellMinutesRequired || 20;
  const dwellPercent = Math.min(
    100,
    Math.round((dwellState.minutesDwelling / dwellRequired) * 100)
  );

  const handleManualCheckIn = () => {
    const res = onManualCheckIn();
    Alert.alert(res.success ? 'Success!' : 'Notice', res.message);
  };

  if (!gym) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyContainer}>
          <Ionicons name="location-outline" size={40} color="#8E8E93" />
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
            <Ionicons name="barbell" size={20} color="#007AFF" />
          </View>
          <View>
            <Text style={styles.gymName}>{gym.name}</Text>
            <Text style={styles.radiusText}>Geofence radius: {gym.radiusMeters}m</Text>
          </View>
        </View>

        <TouchableOpacity onPress={onOpenGymSettings} style={styles.editBtn}>
          <Ionicons name="settings-outline" size={18} color="#8E8E93" />
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
              ? `You are inside the gym (${distanceMeters}m)`
              : `${distanceMeters > 1000 ? (distanceMeters / 1000).toFixed(1) + ' km' : distanceMeters + 'm'} away`
            : 'Locating GPS...'}
        </Text>
        <TouchableOpacity onPress={onRefreshLocation} style={styles.refreshIcon}>
          <Ionicons name="refresh" size={16} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Dwell Timer / In-Progress Workout */}
      {dwellState.completedToday ? (
        <View style={styles.completedBanner}>
          <Ionicons name="checkmark-done-circle" size={24} color="#34C759" />
          <View style={{ flex: 1 }}>
            <Text style={styles.completedTitle}>Workout Completed Today!</Text>
            <Text style={styles.completedSub}>
              Great job showing up. Your streak has been updated!
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
            Stay inside gym for {Math.max(0, dwellRequired - dwellState.minutesDwelling)} more mins to automatically complete workout.
          </Text>
        </View>
      ) : (
        <View style={styles.dwellBoxIdle}>
          <Ionicons name="navigate-outline" size={18} color="#8E8E93" />
          <Text style={styles.dwellIdleText}>
            Visit your gym for {dwellRequired}+ mins to automatically log your workout.
          </Text>
        </View>
      )}

      {/* Action Button */}
      {!dwellState.completedToday && (
        <TouchableOpacity style={styles.checkInBtn} onPress={handleManualCheckIn}>
          <Ionicons name="checkbox-outline" size={18} color="#FFFFFF" />
          <Text style={styles.checkInBtnText}>Log Workout Now</Text>
        </TouchableOpacity>
      )}
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  setupBtn: {
    backgroundColor: '#007AFF',
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
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gymName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  radiusText: {
    fontSize: 12,
    color: '#8E8E93',
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9F9FB',
    borderRadius: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotInside: {
    backgroundColor: '#34C759',
  },
  statusDotOutside: {
    backgroundColor: '#FF9500',
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
    flex: 1,
  },
  refreshIcon: {
    padding: 4,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E8F5E9',
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  completedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  completedSub: {
    fontSize: 12,
    color: '#388E3C',
    marginTop: 2,
  },
  dwellBox: {
    backgroundColor: '#F0F8FF',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#D0E6FF',
  },
  dwellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dwellTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  dwellTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
  dwellProgressBg: {
    height: 8,
    backgroundColor: '#D0E6FF',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 8,
  },
  dwellProgressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  dwellSub: {
    fontSize: 11,
    color: '#607D8B',
  },
  dwellBoxIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9F9FB',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  dwellIdleText: {
    fontSize: 12,
    color: '#8E8E93',
    flex: 1,
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1C1C1E',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  checkInBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
