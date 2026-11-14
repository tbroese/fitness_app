import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import { StreakCard } from '../../components/StreakCard';
import { WeeklyProgressCard } from '../../components/WeeklyProgressCard';
import { GymStatusCard } from '../../components/GymStatusCard';
import { GpsSimulatorModal } from '../../components/GpsSimulatorModal';
import { FirstTimeNameModal } from '../../components/FirstTimeNameModal';
import { ENABLE_DEBUG_SIMULATOR } from '../../constants/config';
import { theme } from '../../constants/theme';

export default function DashboardScreen() {
  const {
    userProfile,
    preferences,
    streakState,
    workouts,
    dwellState,
    currentDistanceMeters,
    isLoading,
    refreshLocation,
    updateUserProfile,
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
  const showOnboardingModal = !isLoading && !userProfile.hasCompletedOnboarding;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
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
        {/* Top Header with User Profile Pill */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => router.push('/profile')}
            activeOpacity={0.8}
          >
            <View style={styles.avatarBadge}>
              <Ionicons name="person" size={20} color={theme.primaryLight} />
            </View>
            <View>
              <Text style={styles.dateText}>{todayFormatted.toUpperCase()}</Text>
              <Text style={styles.welcomeText}>
                {userProfile.fullName || 'Welcome'}
              </Text>
            </View>
          </TouchableOpacity>

          {ENABLE_DEBUG_SIMULATOR && (
            <TouchableOpacity
              style={styles.simBadge}
              onPress={() => setSimulatorVisible(true)}
            >
              <Ionicons name="flask" size={16} color="#C084FC" />
              <Text style={styles.simBadgeText}>Simulator</Text>
            </TouchableOpacity>
          )}
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

        {/* Scheduled Goal Banner (if queued for Monday) */}
        {preferences.pendingWeeklyGoal && (
          <TouchableOpacity
            style={styles.scheduledBanner}
            onPress={() => router.push('/goal')}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.warning} />
            <Text style={styles.scheduledBannerText}>
              Goal will change to {preferences.pendingWeeklyGoal} workouts/week starting next Monday.
            </Text>
            <Ionicons name="chevron-forward" size={14} color={theme.warning} />
          </TouchableOpacity>
        )}

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

      {/* First-Time Full Name Onboarding Prompt */}
      <FirstTimeNameModal
        visible={showOnboardingModal}
        onSaveName={updateUserProfile}
      />

      {/* Simulator Modal for testing */}
      {ENABLE_DEBUG_SIMULATOR && (
        <GpsSimulatorModal
          visible={simulatorVisible}
          onClose={() => setSimulatorVisible(false)}
        />
      )}
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
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  dateText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textSecondary,
    letterSpacing: 1,
  },
  welcomeText: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.textPrimary,
    marginTop: 1,
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
  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.warningMuted,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  scheduledBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.warning,
    flex: 1,
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
