import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import { UserGender, WeightUnit } from '../../types/fitness';
import {
  convertFromKg,
  convertToKg,
  formatWeightWithUnit,
} from '../../utils/weightUtils';
import { theme } from '../../constants/theme';

type LiftKey = 'squat' | 'bench' | 'deadlift';

const LIFT_LABELS: Record<LiftKey, string> = {
  squat: 'Squat PR',
  bench: 'Bench PR',
  deadlift: 'Deadlift PR',
};

export default function ProfileScreen() {
  const {
    userProfile,
    streakState,
    workouts,
    updateUserProfile,
    updateLiftPrs,
    deleteAccount,
  } = useFitness();

  const [settingsVisible, setSettingsVisible] = useState(false);
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

    const kgValue = convertToKg(parsed, prUnit);
    await updateLiftPrs({
      squatPrKg: editingLift === 'squat' ? kgValue : undefined,
      benchPrKg: editingLift === 'bench' ? kgValue : undefined,
      deadliftPrKg: editingLift === 'deadlift' ? kgValue : undefined,
      preferredWeightUnit: prUnit,
    });
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
      Alert.alert('Saved', 'Age cleared.');
      return;
    }

    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed) || parsed < 13 || parsed > 110) {
      Alert.alert('Invalid Age', 'Please enter an age between 13 and 110, or leave blank.');
      return;
    }

    await updateUserProfile(userProfile.fullName || 'Athlete', { age: parsed });
    Alert.alert('Saved', `Age updated to ${parsed}.`);
  };

  const handleSaveName = async () => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      Alert.alert('Display Name Required', 'Please enter your display name.');
      return;
    }

    await updateUserProfile(trimmed);
    setSettingsVisible(false);
    Alert.alert('Saved', 'Your display name has been updated.');
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
            <Text style={styles.statValue}>{totalMinutes}m</Text>
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
          <View style={styles.ageRow}>
            <TextInput
              style={[styles.input, styles.ageInput]}
              value={ageInput}
              onChangeText={setAgeInput}
              keyboardType="number-pad"
              placeholder="Leave blank or enter age"
              placeholderTextColor={theme.textTertiary}
              maxLength={3}
              returnKeyType="done"
              onSubmitEditing={handleSaveAge}
            />
            <TouchableOpacity style={styles.ageSaveBtn} onPress={handleSaveAge}>
              <Text style={styles.ageSaveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
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

            <Text style={styles.fieldLabel}>Weight ({prUnit})</Text>
            <TextInput
              style={styles.input}
              value={prInput}
              onChangeText={setPrInput}
              keyboardType="decimal-pad"
              placeholder={`Enter ${prUnit} (e.g. ${prUnit === 'lbs' ? '225' : '100'})`}
              placeholderTextColor={theme.textTertiary}
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

            {/* Edit Display Name */}
            <Text style={styles.fieldLabel}>Edit Display Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your display name"
              placeholderTextColor={theme.textTertiary}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
              <Text style={styles.saveBtnText}>Save Name</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

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
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    fontSize: 17,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  sectionDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 17,
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
    fontSize: 13,
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
});
