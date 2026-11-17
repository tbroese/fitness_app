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
import { theme } from '../../constants/theme';

export default function ProfileScreen() {
  const {
    userProfile,
    streakState,
    workouts,
    updateUserProfile,
    deleteAccount,
  } = useFitness();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [fullName, setFullName] = useState(userProfile.fullName);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setFullName(userProfile.fullName);
  }, [userProfile.fullName]);

  const totalMinutes = workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  const memberSince = new Date(userProfile.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

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
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {/* Settings Modal */}
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
    marginVertical: 14,
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
  sectionCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
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
