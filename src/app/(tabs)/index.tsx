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
import { theme } from '../../constants/theme';

export default function DashboardScreen() {
  const {
    preferences,
    streakState,
    workouts,
    dwellState,
    currentDistanceMeters,
    refreshLocation,
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

  const isReset = streakState.streakStatus === 'reset';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primaryLight}
          />
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
            <Ionicons name="flask" size={16} color="#C084FC" />
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
          isReset={isReset}
        />

        {/* 3. Gym Geofence & Dwell Status */}
        <GymStatusCard
          gym={preferences.gymLocation}
          dwellState={dwellState}
          distanceMeters={currentDistanceMeters}
          onRefreshLocation={refreshLocation}
          onOpenGymSettings={() => router.push('/goal')}
        />

        {/* Info Banner on streak mechanics */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={theme.primaryLight} />
          <Text style={styles.infoText}>
            Streaks increment with each gym visit. If there are fewer days left in the week than needed to hit your target of {preferences.weeklyGoal} workouts, your streak resets and starts again next week.
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
    backgroundColor: theme.background,
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
    color: theme.textSecondary,
    letterSpacing: 1,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.textPrimary,
    marginTop: 2,
  },
  simBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  simBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C084FC',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.cardBackground,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  infoText: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
});
