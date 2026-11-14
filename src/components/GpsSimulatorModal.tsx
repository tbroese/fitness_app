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
import { theme } from '../constants/theme';

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
        : `Simulated prior week with only ${workouts} workouts (< goal ${preferences.weeklyGoal}). Streak lost. Your new streak will start next week.`
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
              <Ionicons name="close" size={22} color={theme.textSecondary} />
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
                  <Ionicons name="timer-outline" size={16} color={theme.primaryLight} />
                  <Text style={styles.btnOutlineText}>+10 Mins</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnGreen, { flex: 1.2 }]}
                  onPress={() => simulateDwellProgress(15)}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.btnText}>Complete 15m Dwell</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => simulateLeaveGym()}
              >
                <Ionicons name="exit-outline" size={18} color={theme.textPrimary} />
                <Text style={styles.btnSecondaryText}>Simulate Leaving Gym (2.5km away)</Text>
              </TouchableOpacity>
            </View>

            {/* Weekly Reset Testing */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. TEST WEEKLY RESET LOGIC</Text>
              <Text style={styles.sectionDesc}>
                Simulate missed goal to verify: "Streak lost. Your new streak will start next week."
              </Text>

              <TouchableOpacity
                style={[styles.btn, styles.btnOrange]}
                onPress={() => handleTestReset(false)}
              >
                <Ionicons name="alert-circle" size={18} color="#FFFFFF" />
                <Text style={styles.btnText}>
                  Test Prior Week MISSED (Streak Resets to 0)
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
                <Ionicons name="trash-outline" size={18} color={theme.danger} />
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: theme.cardBackgroundSubtle,
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
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionDesc: {
    fontSize: 12,
    color: theme.textTertiary,
    marginBottom: 10,
    lineHeight: 16,
  },
  stateGrid: {
    flexDirection: 'row',
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  stateItem: {
    flex: 1,
    alignItems: 'center',
  },
  stateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  stateValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.textPrimary,
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
    backgroundColor: theme.primary,
  },
  btnGreen: {
    backgroundColor: theme.success,
  },
  btnOrange: {
    backgroundColor: theme.warning,
  },
  btnSecondary: {
    backgroundColor: theme.cardBackgroundSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.primaryMuted,
  },
  btnDanger: {
    backgroundColor: theme.dangerMuted,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnSecondaryText: {
    color: theme.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  btnOutlineText: {
    color: theme.primaryLight,
    fontWeight: '700',
    fontSize: 13,
  },
  btnDangerText: {
    color: theme.danger,
    fontWeight: '700',
    fontSize: 13,
  },
});
