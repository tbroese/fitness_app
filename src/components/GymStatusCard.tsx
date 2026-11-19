import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GymLocation, DwellSessionState, FIXED_DWELL_MINUTES } from '../types/fitness';
import { formatGymDuration } from '../utils/dateUtils';
import { AppTheme } from '../constants/theme';
import { useFitness } from '../context/FitnessContext';

interface GymStatusCardProps {
  gym: GymLocation | null;
  dwellState: DwellSessionState;
  distanceMeters: number | null;
  autoDetectGym: boolean;
  permissionStatus: { foregroundGranted: boolean; backgroundGranted: boolean };
  onRefreshLocation: () => void;
  onOpenGymSettings: () => void;
  onToggleAutoTracking: () => void;
  onStartManualSession: () => void;
  onEndManualSession?: () => void;
}

export const GymStatusCard: React.FC<GymStatusCardProps> = ({
  gym,
  dwellState,
  distanceMeters,
  autoDetectGym,
  permissionStatus,
  onRefreshLocation,
  onOpenGymSettings,
  onToggleAutoTracking,
  onStartManualSession,
  onEndManualSession,
}) => {
  const { theme, distanceUnit } = useFitness();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isAutoTrackingOn = autoDetectGym && permissionStatus.backgroundGranted;
  const isInside = distanceMeters !== null && gym !== null && distanceMeters <= gym.radiusMeters;
  const dwellRequired = FIXED_DWELL_MINUTES;
  const dwellPercent = Math.min(
    100,
    Math.round((dwellState.minutesDwelling / dwellRequired) * 100)
  );

  if (!gym) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={onOpenGymSettings}
        activeOpacity={0.85}
      >
        <View style={styles.emptyContainer}>
          <View style={styles.setupIconCircle}>
            <Ionicons name="location-outline" size={28} color={theme.primaryLight} />
          </View>
          <Text style={styles.emptyTitle}>Setup Gym Location</Text>
          <Text style={styles.emptySub}>
            Set your gym location so the app can automatically detect workouts and track your streak.
          </Text>
          <View style={styles.setupBtn}>
            <Text style={styles.setupBtnText}>Setup Gym Location</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.onPrimary} />
          </View>
        </View>
      </TouchableOpacity>
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
              {gym.isManual
                ? `Manual check-in/out • Auto-checkout after 180 mins`
                : `Automatic GPS verification • ${dwellRequired} mins stay required`}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onOpenGymSettings} style={styles.editBtn}>
          <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Proximity / Location State (GPS gyms only) */}
      {!gym.isManual && (
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
                : distanceUnit === 'mi'
                ? `${
                    distanceMeters >= 800
                      ? (distanceMeters / 1609.344).toFixed(1) + ' mi'
                      : distanceMeters + 'm'
                  } away`
                : `${
                    distanceMeters >= 1000
                      ? (distanceMeters / 1000).toFixed(1) + ' km'
                      : distanceMeters + 'm'
                  } away`
              : permissionStatus.foregroundGranted
              ? 'Locating GPS...'
              : 'Location permission needed'}
          </Text>
          <TouchableOpacity onPress={onRefreshLocation} style={styles.refreshIcon}>
            <Ionicons name="refresh" size={16} color={theme.primaryLight} />
          </TouchableOpacity>
        </View>
      )}

      {/* Layer 1: Auto-Tracking Toggle (GPS gyms only) */}
      {!gym.isManual && (
        <TouchableOpacity
          style={styles.autoTrackRow}
          onPress={onToggleAutoTracking}
          activeOpacity={0.85}
        >
          <View style={styles.autoTrackLeft}>
            <View
              style={[
                styles.autoTrackDot,
                isAutoTrackingOn
                  ? styles.autoTrackDotOn
                  : styles.autoTrackDotOff,
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.autoTrackTitle}>Auto-Tracking (Hands-Free)</Text>
              <Text style={styles.autoTrackSub}>
                {isAutoTrackingOn
                  ? 'Active • Tap to switch to manual check-in'
                  : permissionStatus.backgroundGranted
                  ? 'Manual Check-In • Tap to enable Auto-Tracking'
                  : permissionStatus.foregroundGranted
                  ? 'Foreground-only • Tap to select "Allow all the time"'
                  : 'Off • Tap to enable location tracking'}
              </Text>
            </View>
          </View>
          <Switch
            value={isAutoTrackingOn}
            onValueChange={onToggleAutoTracking}
            trackColor={{ false: theme.cardBorder, true: theme.success }}
            thumbColor="#FFFFFF"
          />
        </TouchableOpacity>
      )}

      {/* Dwell Timer / In-Progress Workout */}
      {dwellState.completedToday && dwellState.isDwelling ? (
        <View>
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-done-circle" size={24} color={theme.success} />
            <View style={{ flex: 1 }}>
              <View style={styles.completedHeaderRow}>
                <Text style={styles.completedTitle}>Workout Verified!</Text>
                <Text style={styles.liveSessionBadge}>{formatGymDuration(dwellState.minutesDwelling)}</Text>
              </View>
              <Text style={styles.completedSub}>
                {gym.isManual
                  ? '15-min goal reached. Tap Check Out when finished (auto-checkout at 180 mins).'
                  : '15-min goal reached. Continuing to track your gym time while you stay!'}
              </Text>
            </View>
          </View>
          {(gym.isManual || !isAutoTrackingOn) && onEndManualSession && (
            <TouchableOpacity
              style={styles.manualCheckOutBtn}
              onPress={onEndManualSession}
              activeOpacity={0.85}
            >
              <Ionicons name="stop-circle-outline" size={18} color={theme.danger} />
              <Text style={styles.manualCheckOutText}>Check Out of Gym</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : dwellState.completedToday ? (
        <View style={styles.completedBanner}>
          <Ionicons name="checkmark-done-circle" size={24} color={theme.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.completedTitle}>Workout Completed Today!</Text>
            <Text style={styles.completedSub}>
              Total time in gym today: {formatGymDuration(Math.max(dwellRequired, dwellState.minutesDwelling))}. Your streak has been updated!
            </Text>
          </View>
        </View>
      ) : dwellState.isDwelling ? (
        <View>
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
              {gym.isManual
                ? `Stay checked in for ${Math.max(0, dwellRequired - dwellState.minutesDwelling)} more mins to log your workout.`
                : `Remain at gym for ${Math.max(0, dwellRequired - dwellState.minutesDwelling)} more mins to automatically log your workout.`}
            </Text>
          </View>
          {(gym.isManual || !isAutoTrackingOn) && onEndManualSession && (
            <TouchableOpacity
              style={styles.manualCheckOutBtn}
              onPress={onEndManualSession}
              activeOpacity={0.85}
            >
              <Ionicons name="stop-circle-outline" size={18} color={theme.danger} />
              <Text style={styles.manualCheckOutText}>Check Out Early</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View>
          <View style={styles.dwellBoxIdle}>
            <Ionicons name="hourglass-outline" size={18} color={theme.textTertiary} />
            <Text style={styles.dwellIdleText}>
              {gym.isManual
                ? `Requires staying checked in for ${dwellRequired} mins. Auto-checkout after 180 mins.`
                : `Requires staying inside the gym for ${dwellRequired} mins. Logging is verified via GPS.`}
            </Text>
          </View>

          {/* Manual Check-In (Home/Manual gym OR GPS gym when Auto-Tracking is Off) */}
          {(gym.isManual || !isAutoTrackingOn) && (
            <TouchableOpacity
              style={[
                styles.manualCheckInBtn,
                (gym.isManual || isInside) && styles.manualCheckInBtnReady,
              ]}
              onPress={onStartManualSession}
              activeOpacity={0.85}
            >
              <Ionicons
                name="play-circle-outline"
                size={18}
                color={gym.isManual || isInside ? theme.onPrimary : theme.primaryLight}
              />
              <Text
                style={[
                  styles.manualCheckInText,
                  (gym.isManual || isInside) && styles.manualCheckInTextReady,
                ]}
              >
                {gym.isManual
                  ? 'Check In at Gym'
                  : isInside
                  ? 'Start Gym Session (GPS-Verified)'
                  : `Check In at Gym (Requires ≤ ${gym.radiusMeters || 300}m)`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
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
    paddingVertical: 12,
  },
  setupIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  setupBtnText: {
    color: theme.onPrimary,
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
    borderColor: theme.primaryBorder,
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
    backgroundColor: theme.brandRed,
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
  autoTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  autoTrackLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  autoTrackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  autoTrackDotOn: {
    backgroundColor: theme.success,
  },
  autoTrackDotOff: {
    backgroundColor: theme.textTertiary,
  },
  autoTrackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  autoTrackSub: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 1,
  },
  manualCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: theme.primaryMuted,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  manualCheckInBtnReady: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  manualCheckInText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  manualCheckInTextReady: {
    color: theme.onPrimary,
  },
  manualCheckOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: theme.dangerMuted,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  manualCheckOutText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.danger,
  },
});
