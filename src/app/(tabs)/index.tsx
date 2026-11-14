import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import { StreakCard } from '../../components/StreakCard';
import { WeeklyProgressCard } from '../../components/WeeklyProgressCard';
import { GymStatusCard } from '../../components/GymStatusCard';
import { GpsSimulatorModal } from '../../components/GpsSimulatorModal';

export default function DashboardScreen() {
  const {
    preferences,
    streakState,
    workouts,
    dwellState,
    currentDistanceMeters,
    refreshLocation,
    triggerManualCheckIn,
  } = useFitness();

  const [refreshing, setRefreshing] = useState(false);
  const [simulatorVisible, setSimulatorVisible] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshLocation();
    setRefreshing(false);
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>{todayFormatted.toUpperCase()}</Text>
            <Text style={styles.welcomeText}>Habit Accountability</Text>
          </View>

          <TouchableOpacity
            style={styles.simBadge}
            onPress={() => setSimulatorVisible(true)}
          >
            <Ionicons name="flask" size={16} color="#7C3AED" />
            <Text style={styles.simBadgeText}>Simulator</Text>
          </TouchableOpacity>
        </View>

        {/* 1. Visit Streak Card */}
        <StreakCard
          streakState={streakState}
          weeklyGoal={preferences.weeklyGoal}
        />

        {/* 2. Weekly Goal & Calendar Card */}
        <WeeklyProgressCard
          weeklyGoal={preferences.weeklyGoal}
          currentWeekWorkouts={streakState.currentWeekWorkouts}
          workouts={workouts}
        />

        {/* 3. Gym Geofence & Dwell Status */}
        <GymStatusCard
          gym={preferences.gymLocation}
          dwellState={dwellState}
          distanceMeters={currentDistanceMeters}
          onRefreshLocation={refreshLocation}
          onManualCheckIn={triggerManualCheckIn}
          onOpenGymSettings={() => router.push('/goal')}
        />

        {/* Info Banner on streak mechanics */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Streaks increment with each gym visit. If you do not hit your target of {preferences.weeklyGoal} workouts this week, your streak resets to 0.
          </Text>
        </View>
      </ScrollView>

      {/* Simulator Modal for testing */}
      <GpsSimulatorModal
        visible={simulatorVisible}
        onClose={() => setSimulatorVisible(false)}
      />
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
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 2,
  },
  simBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  simBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 17,
    flex: 1,
    fontWeight: '500',
  },
});
