import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { SignInAccountInput } from '../context/FitnessContext';
import { cloudDatabase, getOAuthRedirectUri } from '../services/cloud';
import { theme } from '../constants/theme';

interface FirstTimeNameModalProps {
  visible: boolean;
  userTag?: string;
  onSignIn: (input: SignInAccountInput) => Promise<{ restoredExisting: boolean }>;
}

function extractAccessTokenFromUrl(url: string): string | null {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const paramString =
    hashIndex !== -1
      ? url.slice(hashIndex + 1)
      : queryIndex !== -1
      ? url.slice(queryIndex + 1)
      : '';
  if (!paramString) return null;

  const pairs = paramString.split('&');
  for (const pair of pairs) {
    const [k, v] = pair.split('=');
    if (decodeURIComponent(k) === 'access_token' && v) {
      return decodeURIComponent(v);
    }
  }
  return null;
}

export const FirstTimeNameModal: React.FC<FirstTimeNameModalProps> = ({
  visible,
  userTag = '4821',
  onSignIn,
}) => {
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittingProvider, setSubmittingProvider] = useState<
    'google' | 'apple' | 'device' | null
  >(null);

  // Listen for OAuth redirect callback (`fitnesstracker://auth-callback#access_token=...`)
  // Automatically extracts email + full name from Google / Apple account!
  useEffect(() => {
    if (!visible) return;

    const subscription = Linking.addEventListener('url', async ({ url }) => {
      const token = extractAccessTokenFromUrl(url);
      if (!token) return;

      const provider = submittingProvider === 'apple' ? 'apple' : 'google';
      const identity = await cloudDatabase.getUserFromAccessToken(token, provider);
      setSubmittingProvider(null);

      if (identity) {
        const result = await onSignIn({
          fullName: identity.fullName,
          email: identity.email,
          authProvider: identity.provider,
        });
        if (result.restoredExisting) {
          Alert.alert(
            'Welcome Back!',
            `Signed in as ${identity.fullName} (${identity.email}) and restored your streak & tag.`
          );
        }
      } else {
        setErrorMsg('Could not read profile from OAuth redirect.');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [visible, submittingProvider, onSignIn]);

  const handleOAuthButton = async (provider: 'google' | 'apple') => {
    setErrorMsg(null);
    const redirectUri = getOAuthRedirectUri();
    const authUrl = cloudDatabase.getOAuthAuthorizeUrl(provider, redirectUri);

    if (!authUrl) {
      setErrorMsg('Supabase URL is not configured yet.');
      return;
    }

    setSubmittingProvider(provider);
    try {
      await Linking.openURL(authUrl);
    } catch (e) {
      console.warn('Could not open OAuth URL:', e);
      setErrorMsg('Could not launch browser for sign-in.');
      setSubmittingProvider(null);
    }
  };

  const handleQuickNameContinue = async () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter your display name or tap Google / Apple above.');
      return;
    }

    setErrorMsg(null);
    setSubmittingProvider('device');
    try {
      await onSignIn({
        fullName: trimmedName,
        authProvider: 'device',
      });
    } catch (e) {
      console.warn('Quick sign-in failed:', e);
      setErrorMsg('Could not save profile. Please try again.');
    } finally {
      setSubmittingProvider(null);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={28} color={theme.primaryLight} />
          </View>

          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>
            Sign in with one tap using Google or Apple ID. Your email and name are fetched automatically from your account.
          </Text>

          {/* One-Tap OAuth Buttons (No manual email input needed!) */}
          <TouchableOpacity
            style={styles.oauthGoogleBtn}
            onPress={() => handleOAuthButton('google')}
            disabled={submittingProvider !== null}
            activeOpacity={0.85}
          >
            {submittingProvider === 'google' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#FFFFFF" />
                <Text style={styles.oauthBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.oauthAppleBtn}
            onPress={() => handleOAuthButton('apple')}
            disabled={submittingProvider !== null}
            activeOpacity={0.85}
          >
            {submittingProvider === 'apple' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.oauthBtnText}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR QUICK START</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.nameHeaderRow}>
            <Text style={styles.label}>Display Name</Text>
            <View style={styles.tagPreviewBadge}>
              <Text style={styles.tagPreviewText}>#{userTag}</Text>
            </View>
          </View>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Enter your name"
            placeholderTextColor={theme.textTertiary}
            returnKeyType="done"
            onSubmitEditing={handleQuickNameContinue}
          />

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleQuickNameContinue}
            disabled={submittingProvider !== null}
          >
            <Text style={styles.saveBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.cardBackground,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 19,
  },
  oauthGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 10,
  },
  oauthAppleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1E293B',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  oauthBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.cardBorder,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.textTertiary,
    letterSpacing: 1,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 6,
  },
  tagPreviewBadge: {
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  tagPreviewText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.primaryLight,
  },
  input: {
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: theme.textPrimary,
  },
  errorText: {
    color: theme.danger,
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: theme.cardBackgroundSubtle,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: theme.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
});
