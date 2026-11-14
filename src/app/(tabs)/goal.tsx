import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import {
  getCurrentCoordinates,
  requestLocationPermissions,
  setupGymGeofence,
} from '../../services/locationService';
import { theme } from '../../constants/theme';
import { FIXED_DWELL_MINUTES } from '../../types/fitness';
import {
  formatDateToYYYYMMDD,
  getAvailableWorkoutDaysRemaining,
} from '../../utils/dateUtils';

export default function GoalSetupScreen() {
  const { preferences, streakState, workouts, setWeeklyGoal, updateGymLocation } = useFitness();

  const [selectedGoal, setSelectedGoal] = useState<number>(preferences.weeklyGoal);
  const [gymName, setGymName] = useState<string>(preferences.gymLocation?.name || 'My Local Gym');
  const [lat, setLat] = useState<string>(
    preferences.gymLocation ? String(preferences.gymLocation.latitude) : '37.7749'
  );
  const [lon, setLon] = useState<string>(
    preferences.gymLocation ? String(preferences.gymLocation.longitude) : '-122.4194'
  );
  const [radius, setRadius] = useState<number>(preferences.gymLocation?.radiusMeters || 150);
  const [isLocating, setIsLocating] = useState(false);

  // Sync selected goal whenever preferences changes to eliminate any lag or stale state
  useEffect(() => {
    setSelectedGoal(preferences.weeklyGoal);
  }, [preferences.weeklyGoal]);

  const goalOptions = [1, 2, 3, 4, 5, 6, 7];
  const radiusOptions = [100, 150, 200, 300];

  const handleSelectGoal = async (newGoal: number) => {
    if (newGoal === preferences.weeklyGoal) return;

    // Check if today is Monday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const isMonday = new Date().getDay() === 1;

    // Warning 1: Decreasing day goal not on Monday will reset streak
    if (newGoal < preferences.weeklyGoal && !isMonday) {
      Alert.alert(
        'Warning: Mid-Week Goal Decrease',
        'Decreasing your weekly goal on any day other than Monday will immediately reset your current streak to 0!\n\nTo protect your streak, goal decreases can only be made on Monday without penalty.\n\nDo you want to proceed and reset your streak?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setSelectedGoal(preferences.weeklyGoal),
          },
          {
            text: 'Reset & Change Goal',
            style: 'destructive',
            onPress: async () => {
              setSelectedGoal(newGoal);
              await setWeeklyGoal(newGoal, true); // true = force reset streak
            },
          },
        ]
      );
      return;
    }

    // Warning 2: Increasing days will make the streak impossible for current week
    if (newGoal > preferences.weeklyGoal) {
      const todayStr = formatDateToYYYYMMDD(new Date());
      const workedOutToday = workouts.some((w) => w.dateString === todayStr);
      const daysAvailable = getAvailableWorkoutDaysRemaining(new Date(), workedOutToday);
      const currentWeekWorkouts = streakState.currentWeekWorkouts;
      const maxPossibleWorkouts = currentWeekWorkouts + daysAvailable;

      if (newGoal > maxPossibleWorkouts) {
        Alert.alert(
          'Warning: Goal Exceeds Remaining Days',
          `Increasing your goal to ${newGoal} days is impossible to achieve with only ${daysAvailable} day(s) left in the week (current: ${currentWeekWorkouts}/${newGoal}).\n\nThis will immediately cause your streak to be lost!\n\nDo you still want to proceed?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setSelectedGoal(preferences.weeklyGoal),
            },
            {
              text: 'Proceed Anyway',
              style: 'destructive',
              onPress: async () => {
                setSelectedGoal(newGoal);
                await setWeeklyGoal(newGoal, false);
              },
            },
          ]
        );
        return;
      }
    }

    // Immediate change when valid
    setSelectedGoal(newGoal);
    await setWeeklyGoal(newGoal, false);
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { foregroundGranted } = await requestLocationPermissions();
      if (!foregroundGranted) {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access to automatically configure your gym coordinates.'
        );
        setIsLocating(false);
        return;
      }

      const coords = await getCurrentCoordinates();
      if (coords) {
        setLat(coords.latitude.toFixed(6));
        setLon(coords.longitude.toFixed(6));
        Alert.alert(
          'Location Detected',
          `Captured coordinates:\nLatitude: ${coords.latitude.toFixed(4)}\nLongitude: ${coords.longitude.toFixed(4)}`
        );
      } else {
        Alert.alert('Error', 'Could not retrieve your current location.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to retrieve location.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSaveGym = async () => {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid numerical latitude and longitude.');
      return;
    }

    const newGym = {
      id: preferences.gymLocation?.id || `gym_${Date.now()}`,
      name: gymName.trim() || 'My Gym',
      latitude: parsedLat,
      longitude: parsedLon,
      radiusMeters: radius,
      dwellMinutesRequired: FIXED_DWELL_MINUTES,
    };

    await updateGymLocation(newGym);
    setupGymGeofence(newGym);

    Alert.alert('Saved!', `Gym "${newGym.name}" configured with ${radius}m geofence and ${FIXED_DWELL_MINUTES}m required dwell.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Section 1: Weekly Goal */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy-outline" size={22} color={theme.primaryLight} />
            <Text style={styles.sectionTitle}>Weekly Workout Goal</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Select how many workouts you plan to do each week. Changes take effect immediately.
          </Text>

          {/* Goal selection pills */}
          <View style={styles.goalRow}>
            {goalOptions.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.goalPill, selectedGoal === g && styles.goalPillSelected]}
                onPress={() => handleSelectGoal(g)}
              >
                <Text style={[styles.goalPillText, selectedGoal === g && styles.goalPillTextSelected]}>
                  {g}
                </Text>
                <Text style={[styles.goalPillSub, selectedGoal === g && styles.goalPillSubSelected]}>
                  {g === 1 ? 'day' : 'days'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.goalSummaryBox}>
            <Text style={styles.goalSummaryText}>
              Target: <Text style={{ fontWeight: '800', color: theme.primaryLight }}>{selectedGoal} workouts per week</Text>
            </Text>
            <Text style={styles.goalSummarySub}>
              {selectedGoal >= 5
                ? '🔥 High intensity: true dedication to athletic performance.'
                : selectedGoal >= 3
                ? '💪 Balanced: great for sustainable habit building.'
                : '🌱 Starting foundation: consistency is key.'}
            </Text>
          </View>

          {/* Rule Reminder Alert */}
          <View style={styles.ruleReminderBox}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.warning} />
            <Text style={styles.ruleReminderText}>
              Goal Rule: Decreasing your goal mid-week (Tue–Sun) resets your streak to 0. Adjust goals on Monday to protect your streak.
            </Text>
          </View>
        </View>

        {/* Section 2: Gym Location & Geofence */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={22} color={theme.primaryLight} />
            <Text style={styles.sectionTitle}>Gym Location & Geofence</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Set your gym coordinates. GPS requires remaining at the gym for {FIXED_DWELL_MINUTES} minutes to automatically complete a workout.
          </Text>

          {/* Gym Name */}
          <Text style={styles.fieldLabel}>Gym Name</Text>
          <TextInput
            style={styles.input}
            value={gymName}
            onChangeText={setGymName}
            placeholder="e.g. Gold's Gym Downtown"
            placeholderTextColor={theme.textTertiary}
          />

          {/* Quick detect button */}
          <TouchableOpacity
            style={styles.gpsDetectBtn}
            onPress={handleUseCurrentLocation}
            disabled={isLocating}
          >
            <Ionicons name="navigate" size={16} color={theme.primaryLight} />
            <Text style={styles.gpsDetectText}>
              {isLocating ? 'Detecting GPS...' : 'Set To Current Location'}
            </Text>
          </TouchableOpacity>

          {/* Coordinates */}
          <View style={styles.coordRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={lat}
                onChangeText={setLat}
                keyboardType="numeric"
                placeholder="37.7749"
                placeholderTextColor={theme.textTertiary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={lon}
                onChangeText={setLon}
                keyboardType="numeric"
                placeholder="-122.4194"
                placeholderTextColor={theme.textTertiary}
              />
            </View>
          </View>

          {/* Geofence Radius */}
          <Text style={styles.fieldLabel}>Geofence Radius (Meters)</Text>
          <View style={styles.pillRow}>
            {radiusOptions.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.smallPill, radius === r && styles.smallPillActive]}
                onPress={() => setRadius(r)}
              >
                <Text style={[styles.smallPillText, radius === r && styles.smallPillTextActive]}>
                  {r}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Fixed Dwell Time Notice (Non-configurable) */}
          <View style={styles.fixedDwellNotice}>
            <Ionicons name="timer" size={18} color={theme.primaryLight} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fixedDwellTitle}>Verification Requirement: {FIXED_DWELL_MINUTES} Minutes</Text>
              <Text style={styles.fixedDwellSub}>
                To ensure accountability, workouts cannot be logged manually. You must remain inside the gym perimeter for at least {FIXED_DWELL_MINUTES} minutes.
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGym}>
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Save Gym Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  sectionDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  goalPill: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  goalPillSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  goalPillText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  goalPillTextSelected: {
    color: '#FFFFFF',
  },
  goalPillSub: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 2,
  },
  goalPillSubSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  goalSummaryBox: {
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  goalSummaryText: {
    fontSize: 14,
    color: theme.textPrimary,
  },
  goalSummarySub: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  ruleReminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.warningMuted,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  ruleReminderText: {
    fontSize: 11,
    color: theme.warning,
    flex: 1,
    lineHeight: 15,
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.textPrimary,
  },
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primaryMuted,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  gpsDetectText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  smallPill: {
    flex: 1,
    backgroundColor: theme.cardBackgroundSubtle,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  smallPillActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  smallPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  smallPillTextActive: {
    color: '#FFFFFF',
  },
  fixedDwellNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  fixedDwellTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  fixedDwellSub: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 22,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
