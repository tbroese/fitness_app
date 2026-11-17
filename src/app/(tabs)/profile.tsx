import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import { cloudDatabase, getOAuthRedirectUri } from '../../services/cloud';
import { theme } from '../../constants/theme';

export default function ProfileScreen() {
  const { userProfile, streakState, workouts, updateUserProfile, signOutAccount } =
    useFitness();

  const [fullName, setFullName] = useState(userProfile.fullName);

  useEffect(() => {
    setFullName(userProfile.fullName);
  }, [userProfile.fullName]);

  const totalMinutes = workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  const memberSince = new Date(userProfile.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleSaveProfile = async () => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      Alert.alert('Full Name Required', 'Please enter your full name.');
      return;
    }

    await updateUserProfile(trimmed);
    Alert.alert('Saved', 'Your display name has been updated.');
  };

  const handleLinkOAuth = async (provider: 'google' | 'apple') => {
    const redirectUri = getOAuthRedirectUri();
    const authUrl = cloudDatabase.getOAuthAuthorizeUrl(provider, redirectUri);
    if (!authUrl) {
      Alert.alert('Not Configured', 'Supabase URL is not configured yet.');
      return;
    }
    await Linking.openURL(authUrl);
  };

  const isLinkedOAuth =
    Boolean(userProfile.email) &&
    (userProfile.authProvider === 'google' || userProfile.authProvider === 'apple');

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Hero Profile Banner */}
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
            <Text style={styles.heroMeta}>
              {userProfile.email
                ? `${userProfile.email} • Since ${memberSince}`
                : `Member since ${memberSince}`}
            </Text>
          </View>
          <View style={styles.offlineBadge}>
            <Ionicons
              name={
                userProfile.authProvider === 'google'
                  ? 'logo-google'
                  : userProfile.authProvider === 'apple'
                  ? 'logo-apple'
                  : 'cloud-done-outline'
              }
              size={12}
              color={theme.successLight}
            />
            <Text style={styles.offlineBadgeText}>
              {isLinkedOAuth
                ? userProfile.authProvider === 'google'
                  ? 'Google'
                  : 'Apple ID'
                : 'Synced'}
            </Text>
          </View>
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

        {/* Edit Profile & Linked Account Form */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={22} color={theme.primaryLight} />
            <Text style={styles.sectionTitle}>Profile & Account</Text>
          </View>

          <View style={styles.tagInfoRow}>
            <Text style={styles.tagInfoLabel}>Unique Friend Tag</Text>
            <Text style={styles.tagInfoValue}>
              {userProfile.fullName || 'You'} #{userProfile.userTag || '4821'}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor={theme.textTertiary}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
            <Text style={styles.saveBtnText}>Save Name</Text>
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>One-Tap Account Backup</Text>
          <View style={styles.providerToggleRow}>
            <TouchableOpacity
              style={styles.providerPill}
              onPress={() => handleLinkOAuth('google')}
            >
              <Ionicons name="logo-google" size={15} color={theme.textPrimary} />
              <Text style={styles.providerPillText}>Link Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.providerPill}
              onPress={() => handleLinkOAuth('apple')}
            >
              <Ionicons name="logo-apple" size={16} color={theme.textPrimary} />
              <Text style={styles.providerPillText}>Link Apple ID</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={async () => {
              await signOutAccount();
              router.push('/');
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.textSecondary} />
            <Text style={styles.signOutBtnText}>Sign Out (Test Sign-In Modal)</Text>
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
    borderColor: 'rgba(59, 130, 246, 0.35)',
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
    borderColor: 'rgba(59, 130, 246, 0.35)',
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
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.successMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  offlineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.successLight,
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
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  tagInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginBottom: 6,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 14,
    marginBottom: 8,
  },
  providerToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  providerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.inputBorder,
  },
  providerPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
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
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 14,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.cardBackgroundSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 14,
  },
  signOutBtnText: {
    color: theme.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
});
