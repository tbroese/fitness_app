import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../context/FitnessContext';

interface GpsSimulatorModalProps {
  visible: boolean;
  onClose: () => void;
}

export const GpsSimulatorModal: React.FC<GpsSimulatorModalProps> = ({ visible, onClose }) => {
  const {
    preferences,
    dwellState,
    currentDistanceMeters,
    simulateEnterGym,
    simulateDwellProgress,
    simulateLeaveGym,
    testSimulatePreviousWeek,
    resetAll,
  } = useFitness();

  const handleTestReset = async (metGoal: boolean) => {
    const workouts = metGoal ? preferences.weeklyGoal : Math.max(0, preferences.weeklyGoal - 2);
    await testSimulatePreviousWeek(workouts);
    Alert.alert(
      metGoal ? 'Weekly Goal Met!' : 'Weekly Goal Missed!',
      metGoal
        ? `Simulated prior week with ${workouts} workouts (>= goal ${preferences.weeklyGoal}). Your streak was preserved!`
        : `Simulated prior week with only ${workouts} workouts (< goal ${preferences.weeklyGoal}). Your streak has reset to 0!`
    );
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset Everything',
      'This will clear all streaks, workouts, and reset goals to defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetAll();
            Alert.alert('Reset Complete', 'All data has been reset.');
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>GPS & Streak Simulator</Text>
              <Text style={styles.subtitle}>Test geofencing, dwell time, and weekly resets</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            {/* Current State Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CURRENT SIMULATOR STATE</Text>
              <View style={styles.stateGrid}>
                <View style={styles.stateItem}>
                  <Text style={styles.stateLabel}>At Gym?</Text>
                  <Text style={styles.stateValue}>{dwellState.isDwelling ? 'YES' : 'NO'}</Text>
                </View>
                <View style={styles.stateItem}>
                  <Text style={styles.stateLabel}>Distance</Text>
                  <Text style={styles.stateValue}>
                    {currentDistanceMeters !== null ? `${currentDistanceMeters}m` : 'Unknown'}
                  </Text>
                </View>
                <View style={styles.stateItem}>
                  <Text style={styles.stateLabel}>Dwell Time</Text>
                  <Text style={styles.stateValue}>{dwellState.minutesDwelling} mins</Text>
                </View>
                <View style={styles.stateItem}>
                  <Text style={styles.stateLabel}>Done Today?</Text>
                  <Text style={styles.stateValue}>{dwellState.completedToday ? 'YES' : 'NO'}</Text>
                </View>
              </View>
            </View>

            {/* GPS & Dwell Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. GPS & GEOFENCE ACTIONS</Text>
              <TouchableOpacity
                style={[styles.btn, styles.btnBlue]}
                onPress={() => simulateEnterGym()}
              >
                <Ionicons name="location" size={18} color="#FFFFFF" />
                <Text style={styles.btnText}>Simulate Arriving at Gym (10m away)</Text>
              </TouchableOpacity>

              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnOutline, { flex: 1 }]}
                  onPress={() => simulateDwellProgress(10)}
                >
                  <Ionicons name="timer-outline" size={16} color="#007AFF" />
                  <Text style={styles.btnOutlineText}>+10 Mins Dwell</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnGreen, { flex: 1.2 }]}
                  onPress={() => simulateDwellProgress(preferences.dwellDurationMinutes || 20)}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.btnText}>Trigger Complete</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => simulateLeaveGym()}
              >
                <Ionicons name="exit-outline" size={18} color="#3A3A3C" />
                <Text style={styles.btnSecondaryText}>Simulate Leaving Gym (2.5km away)</Text>
              </TouchableOpacity>
            </View>

            {/* Weekly Reset Testing */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. TEST WEEKLY RESET LOGIC</Text>
              <Text style={styles.sectionDesc}>
                Simulate transition from last week to test if streak resets when workouts &lt; weekly goal ({preferences.weeklyGoal}).
              </Text>

              <TouchableOpacity
                style={[styles.btn, styles.btnOrange]}
                onPress={() => handleTestReset(false)}
              >
                <Ionicons name="alert-circle" size={18} color="#FFFFFF" />
                <Text style={styles.btnText}>
                  Test Prior Week MISSED (Resets Streak to 0)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnGreen]}
                onPress={() => handleTestReset(true)}
              >
                <Ionicons name="flame" size={18} color="#FFFFFF" />
                <Text style={styles.btnText}>
                  Test Prior Week MET (Streak Preserved)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Reset Data */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.btn, styles.btnDanger]}
                onPress={handleResetData}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                <Text style={styles.btnDangerText}>Reset All Data to Defaults</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  body: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#636366',
    marginBottom: 10,
    lineHeight: 16,
  },
  stateGrid: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 12,
  },
  stateItem: {
    flex: 1,
    alignItems: 'center',
  },
  stateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
  },
  stateValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  btnBlue: {
    backgroundColor: '#007AFF',
  },
  btnGreen: {
    backgroundColor: '#34C759',
  },
  btnOrange: {
    backgroundColor: '#FF9500',
  },
  btnSecondary: {
    backgroundColor: '#F2F2F7',
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
  },
  btnDanger: {
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#FFD2D2',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnSecondaryText: {
    color: '#3A3A3C',
    fontWeight: '600',
    fontSize: 13,
  },
  btnOutlineText: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnDangerText: {
    color: '#FF3B30',
    fontWeight: '700',
    fontSize: 13,
  },
});
