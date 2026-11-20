import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import {
  UserGender,
  WeightUnit,
  DEFAULT_GEOFENCE_RADIUS_METERS,
  MIN_GEOFENCE_RADIUS_METERS,
} from '../../types/fitness';
import {
  convertFromKg,
  convertToKg,
  formatWeightWithUnit,
  getMaxLiftPr,
} from '../../utils/weightUtils';
import { formatGymDuration } from '../../utils/dateUtils';
import { MAX_DISPLAY_NAME_LENGTH, validateDisplayName } from '../../utils/nameValidation';
import { AchievementItem, computeAchievements } from '../../utils/achievements';
import { PRIVACY_POLICY_URL, WEBSITE_URL } from '../../constants/config';
import { AppTheme } from '../../constants/theme';
import { BugReportCategory } from '../../services/cloud';
import { triggerSuccessHaptic } from '../../utils/haptics';

type LiftKey = 'squat' | 'bench' | 'deadlift';

const LIFT_LABELS: Record<LiftKey, string> = {
  squat: 'Squat PR',
  bench: 'Bench PR',
  deadlift: 'Deadlift PR',
};

export default function ProfileScreen() {
  const {
    userProfile,
    preferences,
    streakState,
    workouts,
    friendships,
    updateUserProfile,
    updateLiftPrs,
    deleteAccount,
    theme,
    themeMode,
    setThemeMode,
    distanceUnit,
    setDistanceUnit,
    hapticsEnabled,
    setHapticsEnabled,
    fontSizeMode,
    fontScale,
    setFontSizeMode,
    setGeofenceRadiusMeters,
    syncToCloud,
    isSyncingCloud,
    submitBugReport,
  } = useFitness();

  const styles = useMemo(() => createStyles(theme, fontScale), [theme, fontScale]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementItem | null>(null);
  const [fullName, setFullName] = useState(userProfile.fullName);
  const [ageInput, setAgeInput] = useState(
    userProfile.age ? String(userProfile.age) : ''
  );
  const [deleting, setDeleting] = useState(false);

  // Edit PR modal state
  const [editingLift, setEditingLift] = useState<LiftKey | null>(null);
  const [prUnit, setPrUnit] = useState<WeightUnit>(
    userProfile.preferredWeightUnit || 'lbs'
  );
  const [prInput, setPrInput] = useState('');

  // Bug report modal state
  const [bugReportVisible, setBugReportVisible] = useState(false);
  const [bugCategory, setBugCategory] = useState<BugReportCategory>('ui');
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [submittingBug, setSubmittingBug] = useState(false);

  useEffect(() => {
    setFullName(userProfile.fullName);
  }, [userProfile.fullName]);

  useEffect(() => {
    setAgeInput(userProfile.age ? String(userProfile.age) : '');
  }, [userProfile.age]);

  useEffect(() => {
    if (userProfile.preferredWeightUnit) {
      setPrUnit(userProfile.preferredWeightUnit);
    }
  }, [userProfile.preferredWeightUnit]);

  const totalMinutes = workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  const memberSince = new Date(userProfile.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const displayUnit: WeightUnit = userProfile.preferredWeightUnit || 'lbs';
  const squatKg = userProfile.squatPrKg ?? 0;
  const benchKg = userProfile.benchPrKg ?? 0;
  const deadliftKg = userProfile.deadliftPrKg ?? 0;
  const currentGender: UserGender = userProfile.gender ?? null;

  const achievements: AchievementItem[] = useMemo(
    () =>
      computeAchievements({
        workouts,
        streakState,
        squatKg,
        benchKg,
        deadliftKg,
        friendsCount: friendships.friends.length,
      }),
    [workouts, streakState, squatKg, benchKg, deadliftKg, friendships.friends.length]
  );

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const openEditPrModal = (lift: LiftKey) => {
    const unit = userProfile.preferredWeightUnit || 'lbs';
    const currentKg =
      lift === 'squat' ? squatKg : lift === 'bench' ? benchKg : deadliftKg;
    const converted = convertFromKg(currentKg, unit);
    setPrUnit(unit);
    setPrInput(converted > 0 ? String(converted) : '');
    setEditingLift(lift);
  };

  const handleToggleModalUnit = (nextUnit: WeightUnit) => {
    if (nextUnit === prUnit) return;
    const parsed = parseFloat(prInput);
    if (!isNaN(parsed) && parsed > 0) {
      const asKg = convertToKg(parsed, prUnit);
      const converted = convertFromKg(asKg, nextUnit);
      setPrInput(converted > 0 ? String(converted) : '');
    }
    setPrUnit(nextUnit);
  };

  const handleSavePr = async () => {
    if (!editingLift) return;
    const trimmed = prInput.trim();
    const parsed = trimmed === '' ? 0 : parseFloat(trimmed);

    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid number for your PR.');
      return;
    }

    const maxAllowed = getMaxLiftPr(prUnit);
    if (parsed > maxAllowed) {
      Alert.alert(
        'Weight Too High',
        `Please enter a PR of ${maxAllowed} ${prUnit} or less.`
      );
      return;
    }

    const kgValue = convertToKg(parsed, prUnit);
    await updateLiftPrs({
      squatPrKg: editingLift === 'squat' ? kgValue : undefined,
      benchPrKg: editingLift === 'bench' ? kgValue : undefined,
      deadliftPrKg: editingLift === 'deadlift' ? kgValue : undefined,
      preferredWeightUnit: prUnit,
    });
    triggerSuccessHaptic();
    setEditingLift(null);
  };

  const handleSelectGender = async (nextGender: UserGender) => {
    await updateUserProfile(userProfile.fullName || 'Athlete', {
      gender: nextGender,
    });
  };

  const handleSaveAge = async () => {
    const trimmed = ageInput.trim();
    if (!trimmed) {
      await updateUserProfile(userProfile.fullName || 'Athlete', { age: null });
      return;
    }

    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed) || parsed < 13 || parsed > 110) {
      Alert.alert('Invalid Age', 'Please enter an age between 13 and 110, or leave blank.');
      return;
    }

    await updateUserProfile(userProfile.fullName || 'Athlete', { age: parsed });
  };

  const handleSaveName = async () => {
    const validation = validateDisplayName(fullName);
    if (!validation.valid) {
      Alert.alert('Invalid Display Name', validation.error || 'Please enter a valid display name.');
      return;
    }

    await updateUserProfile(validation.sanitized);
    setSettingsVisible(false);
    Alert.alert('Saved', 'Your display name has been updated.');
  };

  const openBugReportModal = () => {
    setBugCategory('ui');
    setBugTitle('');
    setBugDescription('');
    setSettingsVisible(false);
    setBugReportVisible(true);
  };

  const handleSubmitBugReport = async () => {
    const trimmedTitle = bugTitle.trim();
    const trimmedDesc = bugDescription.trim();
    if (!trimmedTitle) {
      Alert.alert('Summary Required', 'Please enter a short summary of the bug.');
      return;
    }
    if (!trimmedDesc) {
      Alert.alert('Details Required', 'Please describe what happened or how to reproduce it.');
      return;
    }

    setSubmittingBug(true);
    try {
      const appVersion = Constants.expoConfig?.version || '1.0.0';
      const platform = `${Platform.OS} ${String(Platform.Version)}`;
      const ok = await submitBugReport({
        category: bugCategory,
        title: trimmedTitle,
        description: trimmedDesc,
        appVersion,
        platform,
      });

      if (ok) {
        setBugReportVisible(false);
        Alert.alert('Report Sent', 'Thanks for letting us know! Your bug report has been submitted.');
      } else {
        Alert.alert(
          'Could Not Submit',
          'Please check your internet connection and try again.'
        );
      }
    } finally {
      setSubmittingBug(false);
    }
  };

  const handleDeleteAccountPress = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This will erase your streak, workout history, gym settings, friends, and cloud profile. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              setSettingsVisible(false);
              router.replace('/');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Profile Banner with Settings Gear Button */}
        <View style={styles.heroCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={32} color={theme.primaryLight} />
          </View>
          <View style={styles.heroInfo}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{userProfile.fullName || 'New Member'}</Text>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>#{userProfile.userTag || '4821'}</Text>
              </View>
            </View>
            <Text style={styles.heroMeta}>Member since {memberSince}</Text>
          </View>

          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => {
              setFullName(userProfile.fullName);
              setSettingsVisible(true);
            }}
            activeOpacity={0.8}
            accessibilityLabel="Open Settings"
          >
            <Ionicons name="settings-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Career Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streakState.currentStreak} 🔥</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streakState.bestStreak} 🏆</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{workouts.length}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatGymDuration(totalMinutes)}</Text>
            <Text style={styles.statLabel}>Gym Time</Text>
          </View>
        </View>

        {/* Personal Records (Squat, Bench, Deadlift) */}
        <View style={styles.prGrid}>
          <TouchableOpacity
            style={styles.prBox}
            onPress={() => openEditPrModal('squat')}
            activeOpacity={0.8}
          >
            <Text style={styles.prValue}>
              {squatKg > 0 ? formatWeightWithUnit(squatKg, displayUnit) : 'Tap to set'}
            </Text>
            <Text style={styles.prLabel}>Squat PR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.prBox}
            onPress={() => openEditPrModal('bench')}
            activeOpacity={0.8}
          >
            <Text style={styles.prValue}>
              {benchKg > 0 ? formatWeightWithUnit(benchKg, displayUnit) : 'Tap to set'}
            </Text>
            <Text style={styles.prLabel}>Bench PR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.prBox}
            onPress={() => openEditPrModal('deadlift')}
            activeOpacity={0.8}
          >
            <Text style={styles.prValue}>
              {deadliftKg > 0
                ? formatWeightWithUnit(deadliftKg, displayUnit)
                : 'Tap to set'}
            </Text>
            <Text style={styles.prLabel}>Deadlift PR</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.verifyPrBtn}
          onPress={() => {
            const params = new URLSearchParams({
              userId: userProfile.id || '',
              userName: userProfile.fullName || '',
              gymId: preferences.gymLocation?.id || '',
              gymName: preferences.gymLocation?.name || '',
            });
            Linking.openURL(`${WEBSITE_URL}/verify-pr?${params.toString()}`);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="videocam-outline" size={16} color={theme.primaryLight} />
          <Text style={styles.verifyPrBtnText}>Submit PR Video for Verification</Text>
          <Ionicons name="open-outline" size={14} color={theme.textTertiary} />
        </TouchableOpacity>

        {/* Athlete Details (Gender & Age - Optional for Leaderboard Filters) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="body-outline" size={20} color={theme.primaryLight} />
            <Text style={styles.sectionTitle}>Athlete Details</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Optional details used when filtering the leaderboard by gender or age.
          </Text>

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.unitToggleRow}>
            {(
              [
                { key: null, label: 'Not Set' },
                { key: 'male', label: 'Male' },
                { key: 'female', label: 'Female' },
              ] as { key: UserGender; label: string }[]
            ).map((opt) => {
              const active = currentGender === opt.key;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[
                    styles.unitToggleBtn,
                    active && styles.unitToggleBtnActive,
                  ]}
                  onPress={() => handleSelectGender(opt.key)}
                >
                  <Text
                    style={[
                      styles.unitToggleText,
                      active && styles.unitToggleTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Age</Text>
          <TextInput
            style={styles.input}
            value={ageInput}
            onChangeText={(text) => {
              setAgeInput(text);
              const trimmed = text.trim();
              if (!trimmed) {
                updateUserProfile(userProfile.fullName || 'Athlete', { age: null });
              } else {
                const parsed = parseInt(trimmed, 10);
                if (!isNaN(parsed) && parsed >= 13 && parsed <= 110) {
                  updateUserProfile(userProfile.fullName || 'Athlete', { age: parsed });
                }
              }
            }}
            keyboardType="number-pad"
            placeholder="Leave blank or enter age"
            placeholderTextColor={theme.textTertiary}
            maxLength={3}
            returnKeyType="done"
            onSubmitEditing={handleSaveAge}
          />
        </View>

        {/* Unique Friend Tag Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={20} color={theme.primaryLight} />
            <Text style={styles.sectionTitle}>Friend Tag</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Share this tag so friends can find and add you on the Leaderboard.
          </Text>
          <View style={styles.tagInfoRow}>
            <Text style={styles.tagInfoLabel}>Your Unique Tag</Text>
            <Text style={styles.tagInfoValue}>
              {userProfile.fullName || 'You'} #{userProfile.userTag || '4821'}
            </Text>
          </View>
        </View>

        {/* Achievements Card */}
        <View style={styles.sectionCard}>
          <View style={styles.achievementsHeaderRow}>
            <View style={styles.sectionHeader}>
              <Ionicons name="ribbon-outline" size={20} color={theme.primaryLight} />
              <Text style={styles.sectionTitle}>Achievements</Text>
            </View>
            <Text style={styles.achievementsCount}>
              {unlockedCount} / {achievements.length}
            </Text>
          </View>
          <Text style={styles.sectionDesc}>
            Tap any badge to view requirements and progress.
          </Text>

          <View style={styles.achievementsGrid}>
            {achievements.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.achievementBadge,
                  item.unlocked
                    ? styles.achievementBadgeUnlocked
                    : styles.achievementBadgeLocked,
                ]}
                onPress={() => setSelectedAchievement(item)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.achievementIconWrap,
                    item.unlocked
                      ? styles.achievementIconUnlocked
                      : styles.achievementIconLocked,
                  ]}
                >
                  <Ionicons
                    name={item.unlocked ? item.icon : 'lock-closed-outline'}
                    size={18}
                    color={item.unlocked ? theme.primaryLight : theme.textTertiary}
                  />
                </View>
                <Text
                  style={[
                    styles.achievementName,
                    !item.unlocked && styles.achievementNameLocked,
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={styles.achievementStatus}>
                  {item.unlocked ? 'Unlocked' : item.progressText}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Edit Lift PR Modal */}
      <Modal
        visible={editingLift !== null}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setEditingLift(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="barbell-outline" size={20} color={theme.primaryLight} />
                <Text style={styles.modalTitle}>
                  {editingLift ? `Edit ${LIFT_LABELS[editingLift]}` : 'Edit PR'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditingLift(null)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* lbs / kg Toggle */}
            <View style={styles.unitToggleRow}>
              <TouchableOpacity
                style={[
                  styles.unitToggleBtn,
                  prUnit === 'lbs' && styles.unitToggleBtnActive,
                ]}
                onPress={() => handleToggleModalUnit('lbs')}
              >
                <Text
                  style={[
                    styles.unitToggleText,
                    prUnit === 'lbs' && styles.unitToggleTextActive,
                  ]}
                >
                  lbs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitToggleBtn,
                  prUnit === 'kg' && styles.unitToggleBtnActive,
                ]}
                onPress={() => handleToggleModalUnit('kg')}
              >
                <Text
                  style={[
                    styles.unitToggleText,
                    prUnit === 'kg' && styles.unitToggleTextActive,
                  ]}
                >
                  kg
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>
              Weight ({prUnit}) • Max {getMaxLiftPr(prUnit)} {prUnit}
            </Text>
            <TextInput
              style={styles.input}
              value={prInput}
              onChangeText={setPrInput}
              keyboardType="decimal-pad"
              placeholder={`Enter ${prUnit} (e.g. ${prUnit === 'lbs' ? '225' : '100'})`}
              placeholderTextColor={theme.textTertiary}
              maxLength={6}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSavePr}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSavePr}>
              <Text style={styles.saveBtnText}>Save PR</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Achievement Detail Modal */}
      <Modal
        visible={selectedAchievement !== null}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSelectedAchievement(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedAchievement(null)}
        >
          {selectedAchievement && (
            <TouchableOpacity
              style={styles.modalCard}
              activeOpacity={1}
              onPress={() => {}}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons
                    name={
                      selectedAchievement.unlocked
                        ? selectedAchievement.icon
                        : 'lock-closed-outline'
                    }
                    size={22}
                    color={
                      selectedAchievement.unlocked
                        ? theme.primaryLight
                        : theme.textTertiary
                    }
                  />
                  <Text style={styles.modalTitle}>{selectedAchievement.name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedAchievement(null)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.achievementModalStatusPill,
                  selectedAchievement.unlocked
                    ? styles.achievementModalStatusUnlocked
                    : styles.achievementModalStatusLocked,
                ]}
              >
                <Text
                  style={[
                    styles.achievementModalStatusText,
                    {
                      color: selectedAchievement.unlocked
                        ? theme.successLight
                        : theme.textSecondary,
                    },
                  ]}
                >
                  {selectedAchievement.unlocked ? 'UNLOCKED' : 'LOCKED'}
                </Text>
              </View>

              <Text style={styles.achievementModalDesc}>
                {selectedAchievement.description}
              </Text>

              <View style={styles.achievementProgressRow}>
                <Text style={styles.tagInfoLabel}>Progress</Text>
                <Text style={styles.tagInfoValue}>
                  {selectedAchievement.progressText}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>

      {/* Settings Modal (Edit Display Name + Delete Account) */}
      <Modal
        visible={settingsVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSettingsVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="settings-outline" size={20} color={theme.primaryLight} />
                <Text style={styles.modalTitle}>Settings</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSettingsVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            {/* Edit Display Name */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.fieldLabel}>Edit Display Name</Text>
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                {fullName.length}/{MAX_DISPLAY_NAME_LENGTH}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your display name"
              placeholderTextColor={theme.textTertiary}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
              <Text style={styles.saveBtnText}>Save Name</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Advanced Settings (Geofence Range, Units, Haptics, Sync, Version) */}
            <TouchableOpacity
              style={styles.advancedToggleBtn}
              onPress={() => setAdvancedOpen((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="options-outline" size={18} color={theme.textSecondary} />
                <Text style={styles.advancedToggleText}>Advanced Settings</Text>
              </View>
              <Ionicons
                name={advancedOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            {advancedOpen && (
              <View style={styles.advancedBox}>
                {/* 1. Geofence Range */}
                <View style={styles.advancedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.advancedLabel}>Geofence Range</Text>
                    <Text style={styles.advancedSub}>
                      Decrease from 150m default (50m–150m)
                    </Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        (preferences.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS) <=
                          MIN_GEOFENCE_RADIUS_METERS && styles.stepperBtnDisabled,
                      ]}
                      onPress={() =>
                        setGeofenceRadiusMeters(
                          (preferences.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS) - 50
                        )
                      }
                      disabled={
                        (preferences.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS) <=
                        MIN_GEOFENCE_RADIUS_METERS
                      }
                    >
                      <Ionicons name="remove" size={16} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>
                      {preferences.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS}m
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        (preferences.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS) >=
                          DEFAULT_GEOFENCE_RADIUS_METERS && styles.stepperBtnDisabled,
                      ]}
                      onPress={() =>
                        setGeofenceRadiusMeters(
                          (preferences.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS) + 50
                        )
                      }
                      disabled={
                        (preferences.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS) >=
                        DEFAULT_GEOFENCE_RADIUS_METERS
                      }
                    >
                      <Ionicons name="add" size={16} color={theme.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.advancedDivider} />

                {/* 2. Distance Units (mi / km) */}
                <View style={styles.advancedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.advancedLabel}>Distance Units</Text>
                    <Text style={styles.advancedSub}>Used for gym proximity & search</Text>
                  </View>
                  <View style={styles.miniToggleRow}>
                    {(['mi', 'km'] as const).map((unit) => {
                      const active = distanceUnit === unit;
                      return (
                        <TouchableOpacity
                          key={unit}
                          style={[styles.miniToggleBtn, active && styles.miniToggleBtnActive]}
                          onPress={() => setDistanceUnit(unit)}
                        >
                          <Text
                            style={[
                              styles.miniToggleText,
                              active && styles.miniToggleTextActive,
                            ]}
                          >
                            {unit}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.advancedDivider} />

                {/* 3. Haptic Feedback */}
                <View style={styles.advancedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.advancedLabel}>Haptic Feedback</Text>
                    <Text style={styles.advancedSub}>Subtle vibration on tabs, check-ins & PRs</Text>
                  </View>
                  <Switch
                    value={hapticsEnabled}
                    onValueChange={setHapticsEnabled}
                    trackColor={{ false: theme.cardBorder, true: theme.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.advancedDivider} />

                {/* 4. Text Size */}
                <View style={styles.advancedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.advancedLabel}>Text Size</Text>
                    <Text style={styles.advancedSub}>Scales readable text without clipping buttons</Text>
                  </View>
                  <View style={styles.miniToggleRow}>
                    {(
                      [
                        { key: 'standard', label: 'Std' },
                        { key: 'large', label: 'Large' },
                      ] as const
                    ).map((opt) => {
                      const active = fontSizeMode === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.miniToggleBtn, active && styles.miniToggleBtnActive]}
                          onPress={() => setFontSizeMode(opt.key)}
                        >
                          <Text
                            style={[
                              styles.miniToggleText,
                              active && styles.miniToggleTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.advancedDivider} />

                {/* 5. Manual Cloud Sync */}
                <View style={styles.advancedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.advancedLabel}>Cloud Sync</Text>
                    <Text style={styles.advancedSub}>
                      {userProfile.syncedAt
                        ? `Last synced ${new Date(userProfile.syncedAt).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`
                        : 'Not synced yet'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.syncNowBtn}
                    onPress={syncToCloud}
                    disabled={isSyncingCloud}
                    activeOpacity={0.8}
                  >
                    {isSyncingCloud ? (
                      <ActivityIndicator size="small" color={theme.primaryLight} />
                    ) : (
                      <Text style={styles.syncNowText}>Sync Now</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.advancedDivider} />

                {/* 6. App Version */}
                <View style={styles.advancedRow}>
                  <Text style={styles.advancedLabel}>App Version</Text>
                  <Text style={styles.advancedSub}>
                    v{Constants.expoConfig?.version || '1.0.0'}
                  </Text>
                </View>
              </View>
            )}

            {/* Theme Toggle Button */}
            <TouchableOpacity
              style={styles.privacyBtn}
              onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={theme.textPrimary}
              />
              <Text style={styles.privacyBtnText}>
                {themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </Text>
            </TouchableOpacity>

            {/* Report a Bug Button */}
            <TouchableOpacity
              style={styles.privacyBtn}
              onPress={openBugReportModal}
              activeOpacity={0.8}
            >
              <Ionicons name="bug-outline" size={18} color={theme.textPrimary} />
              <Text style={styles.privacyBtnText}>Report a Bug</Text>
            </TouchableOpacity>

            {/* Privacy Policy Link */}
            <TouchableOpacity
              style={styles.privacyBtn}
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.textPrimary} />
              <Text style={styles.privacyBtnText}>Privacy Policy</Text>
              <Ionicons name="open-outline" size={15} color={theme.textTertiary} />
            </TouchableOpacity>

            {/* Delete Account Button in Red Text */}
            <TouchableOpacity
              style={styles.deleteAccountBtn}
              onPress={handleDeleteAccountPress}
              disabled={deleting}
              activeOpacity={0.8}
            >
              {deleting ? (
                <ActivityIndicator color={theme.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                  <Text style={styles.deleteAccountText}>Delete Account</Text>
                </>
              )}
            </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Report a Bug Modal */}
      <Modal
        visible={bugReportVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setBugReportVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="bug-outline" size={20} color={theme.primaryLight} />
                <Text style={styles.modalTitle}>Report a Bug</Text>
              </View>
              <TouchableOpacity
                onPress={() => setBugReportVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.bugCategoryRow}>
              {(
                [
                  { key: 'ui', label: 'UI / Display' },
                  { key: 'location', label: 'Location' },
                  { key: 'sync', label: 'Sync / Account' },
                  { key: 'other', label: 'Other' },
                ] as const
              ).map((cat) => {
                const active = bugCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.bugCategoryChip,
                      active && styles.bugCategoryChipActive,
                    ]}
                    onPress={() => setBugCategory(cat.key)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.bugCategoryText,
                        active && styles.bugCategoryTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Summary</Text>
            <TextInput
              style={styles.input}
              value={bugTitle}
              onChangeText={setBugTitle}
              placeholder="e.g. Check-in timer freezes on background"
              placeholderTextColor={theme.textTertiary}
              maxLength={100}
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>What happened?</Text>
            <TextInput
              style={[styles.input, styles.bugTextArea]}
              value={bugDescription}
              onChangeText={setBugDescription}
              placeholder="Describe the issue and steps to reproduce..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />

            <Text style={styles.bugMetaText}>
              Includes app v{Constants.expoConfig?.version || '1.0.0'} ({Platform.OS}{' '}
              {String(Platform.Version)})
            </Text>

            <TouchableOpacity
              style={[styles.saveBtn, submittingBug && { opacity: 0.7 }]}
              onPress={handleSubmitBugReport}
              disabled={submittingBug}
              activeOpacity={0.85}
            >
              {submittingBug ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>Submit Bug Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme, fontScale: number = 1) => {
  const s = (size: number) => Math.round(size * fontScale);
  return StyleSheet.create({
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
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 14,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  heroInfo: {
    flex: 1,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  tagBadge: {
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.primaryLight,
  },
  heroMeta: {
    fontSize: 12,
    color: theme.textTertiary,
    marginTop: 4,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.cardBackgroundSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  prGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  prBox: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  prValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.primaryLight,
  },
  prLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: s(17),
    fontWeight: '800',
    color: theme.textPrimary,
  },
  sectionDesc: {
    fontSize: s(12),
    color: theme.textSecondary,
    lineHeight: s(17),
    marginBottom: 12,
  },
  ageRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  ageInput: {
    flex: 1,
  },
  ageSaveBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageSaveBtnText: {
    color: theme.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  tagInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundSubtle,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  tagInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  tagInfoValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.primaryLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: theme.cardBackground,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  unitToggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.inputBackground,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  unitToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  unitToggleBtnActive: {
    backgroundColor: theme.primary,
  },
  unitToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  unitToggleTextActive: {
    color: theme.onPrimary,
  },
  fieldLabel: {
    fontSize: s(13),
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 10,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.textPrimary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 14,
  },
  saveBtnText: {
    color: theme.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: theme.cardBorder,
    marginVertical: 18,
  },
  privacyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.cardBackgroundSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginBottom: 10,
  },
  privacyBtnText: {
    color: theme.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.cardBackgroundSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  deleteAccountText: {
    color: theme.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  advancedToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: theme.cardBackgroundSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginBottom: 10,
  },
  advancedToggleText: {
    color: theme.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  advancedBox: {
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginBottom: 10,
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  advancedLabel: {
    color: theme.textPrimary,
    fontWeight: '700',
    fontSize: s(13),
  },
  advancedSub: {
    color: theme.textTertiary,
    fontSize: s(11),
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  stepperValue: {
    color: theme.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    minWidth: 40,
    textAlign: 'center',
  },
  advancedDivider: {
    height: 1,
    backgroundColor: theme.cardBorder,
    marginVertical: 10,
  },
  miniToggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  miniToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  miniToggleBtnActive: {
    backgroundColor: theme.primary,
  },
  miniToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  miniToggleTextActive: {
    color: theme.onPrimary,
  },
  syncNowBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.primaryMuted,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    minWidth: 78,
    alignItems: 'center',
  },
  syncNowText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  achievementsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  achievementsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  achievementBadge: {
    width: '48.3%',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  achievementBadgeUnlocked: {
    backgroundColor: theme.primaryMuted,
    borderColor: theme.primaryBorder,
  },
  achievementBadgeLocked: {
    backgroundColor: theme.cardBackgroundSubtle,
    borderColor: theme.cardBorder,
    opacity: 0.72,
  },
  achievementIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementIconUnlocked: {
    backgroundColor: theme.cardBackground,
  },
  achievementIconLocked: {
    backgroundColor: theme.cardBackground,
  },
  achievementName: {
    fontSize: s(13),
    fontWeight: '800',
    color: theme.textPrimary,
  },
  achievementNameLocked: {
    color: theme.textSecondary,
  },
  achievementStatus: {
    fontSize: s(11),
    color: theme.textTertiary,
    marginTop: 2,
  },
  achievementModalStatusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  achievementModalStatusUnlocked: {
    backgroundColor: theme.successMuted,
  },
  achievementModalStatusLocked: {
    backgroundColor: theme.cardBackgroundSubtle,
  },
  achievementModalStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  achievementModalDesc: {
    fontSize: s(14),
    color: theme.textSecondary,
    lineHeight: s(20),
    marginBottom: 14,
  },
  achievementProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  bugCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bugCategoryChip: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: theme.cardBackgroundSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  bugCategoryChipActive: {
    backgroundColor: theme.primaryMuted,
    borderColor: theme.primary,
  },
  bugCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  bugCategoryTextActive: {
    color: theme.primaryLight,
    fontWeight: '700',
  },
  bugTextArea: {
    minHeight: 96,
    paddingTop: 12,
  },
  bugMetaText: {
    fontSize: 11,
    color: theme.textTertiary,
    marginTop: 8,
  },
  verifyPrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    paddingVertical: 11,
    marginBottom: 14,
  },
  verifyPrBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryLight,
  },
});
};
