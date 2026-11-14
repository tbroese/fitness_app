import React, { useState } from 'react';
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

export default function GoalSetupScreen() {
  const { preferences, setWeeklyGoal, updateGymLocation } = useFitness();

  const [selectedGoal, setSelectedGoal] = useState<number>(preferences.weeklyGoal);
  const [gymName, setGymName] = useState<string>(preferences.gymLocation?.name || 'My Local Gym');
  const [lat, setLat] = useState<string>(
    preferences.gymLocation ? String(preferences.gymLocation.latitude) : '37.7749'
  );
  const [lon, setLon] = useState<string>(
    preferences.gymLocation ? String(preferences.gymLocation.longitude) : '-122.4194'
  );
  const [radius, setRadius] = useState<number>(preferences.gymLocation?.radiusMeters || 150);
  const [dwell, setDwell] = useState<number>(
    preferences.gymLocation?.dwellMinutesRequired || preferences.dwellDurationMinutes || 20
  );
  const [isLocating, setIsLocating] = useState(false);

  const goalOptions = [1, 2, 3, 4, 5, 6, 7];
  const radiusOptions = [100, 150, 200, 300];
  const dwellOptions = [15, 20, 25, 30, 45];

  const handleSelectGoal = async (g: number) => {
    setSelectedGoal(g);
    await setWeeklyGoal(g);
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
      dwellMinutesRequired: dwell,
    };

    await updateGymLocation(newGym);
    setupGymGeofence(newGym);

    Alert.alert('Saved!', `Gym "${newGym.name}" configured with ${radius}m geofence and ${dwell}m dwell time.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Section 1: Weekly Goal */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy-outline" size={22} color="#007AFF" />
            <Text style={styles.sectionTitle}>Weekly Workout Goal</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Select how many workouts you plan to do each week. If you miss this threshold, your streak resets back to 0 at the end of the week.
          </Text>

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
              Target: <Text style={{ fontWeight: '800' }}>{selectedGoal} workouts per week</Text>
            </Text>
            <Text style={styles.goalSummarySub}>
              {selectedGoal >= 5
                ? '🔥 High intensity: true dedication to athletic performance.'
                : selectedGoal >= 3
                ? '💪 Balanced: great for sustainable habit building.'
                : '🌱 Starting foundation: consistency is key.'}
            </Text>
          </View>
        </View>

        {/* Section 2: Gym Location & Geofence */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={22} color="#007AFF" />
            <Text style={styles.sectionTitle}>Gym Location & Geofence</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Set your gym coordinates. When your phone GPS enters this radius and stays for the dwell duration, your workout is verified.
          </Text>

          {/* Gym Name */}
          <Text style={styles.fieldLabel}>Gym Name</Text>
          <TextInput
            style={styles.input}
            value={gymName}
            onChangeText={setGymName}
            placeholder="e.g. Gold's Gym Downtown"
          />

          {/* Quick detect button */}
          <TouchableOpacity
            style={styles.gpsDetectBtn}
            onPress={handleUseCurrentLocation}
            disabled={isLocating}
          >
            <Ionicons name="navigate" size={16} color="#007AFF" />
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

          {/* Dwell Verification Threshold */}
          <Text style={styles.fieldLabel}>Minimum Dwell Time (Anti-Cheat)</Text>
          <Text style={styles.fieldSub}>
            Prevents marking a workout complete if you only drive or walk past the gym.
          </Text>
          <View style={styles.pillRow}>
            {dwellOptions.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.smallPill, dwell === d && styles.smallPillActive]}
                onPress={() => setDwell(d)}
              >
                <Text style={[styles.smallPillText, dwell === d && styles.smallPillTextActive]}>
                  {d} mins
                </Text>
              </TouchableOpacity>
            ))}
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
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
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
    color: '#1C1C1E',
  },
  sectionDesc: {
    fontSize: 13,
    color: '#636366',
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
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  goalPillSelected: {
    backgroundColor: '#007AFF',
  },
  goalPillText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  goalPillTextSelected: {
    color: '#FFFFFF',
  },
  goalPillSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 2,
  },
  goalPillSubSelected: {
    color: '#FFFFFFCC',
  },
  goalSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  goalSummaryText: {
    fontSize: 14,
    color: '#1C1C1E',
  },
  goalSummarySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 14,
    marginBottom: 6,
  },
  fieldSub: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9F9FB',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1C1C1E',
  },
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF12',
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  gpsDetectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
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
    backgroundColor: '#F2F2F7',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  smallPillActive: {
    backgroundColor: '#007AFF',
  },
  smallPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3A3A3C',
  },
  smallPillTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
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
