import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { SignInAccountInput, useFitness } from '../context/FitnessContext';
import { cloudDatabase, getOAuthRedirectUri } from '../services/cloud';
import { storageService } from '../services/storageService';
import { GOOGLE_WEB_CLIENT_ID } from '../constants/config';
import { AppTheme } from '../constants/theme';

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
  onSignIn,
}) => {
  const { theme } = useFitness();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Listen for OAuth redirect callback and automatically sign in
  useEffect(() => {
    if (!visible) return;

    const subscription = Linking.addEventListener('url', async ({ url }) => {
      const token = extractAccessTokenFromUrl(url);
      if (!token) return;

      const identity = await cloudDatabase.getUserFromAccessToken(token, 'google');
      setSubmitting(false);

      if (identity) {
        await onSignIn({
          fullName: identity.fullName,
          email: identity.email,
          authProvider: 'google',
        });
      } else {
        setErrorMsg('Could not read profile from Google sign-in.');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [visible, onSignIn]);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSubmitting(true);

    const isExpoGo =
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

    if (!isExpoGo && GOOGLE_WEB_CLIENT_ID) {
      try {
        const {
          GoogleSignin,
          statusCodes,
        } = require('@react-native-google-signin/google-signin');
        GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
        });
        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();
        const idToken = response?.data?.idToken || (response as any)?.idToken;
        if (!idToken) {
          setSubmitting(false);
          setErrorMsg('Google sign-in did not return an ID token.');
          return;
        }

        const result = await cloudDatabase.signInWithGoogleIdToken(idToken);
        setSubmitting(false);
        if (result) {
          await storageService.saveAuthSession(result.session);
          await onSignIn({
            fullName: result.identity.fullName,
            email: result.identity.email,
            authProvider: 'google',
            authUserId: result.identity.authUserId,
          });
        } else {
          setErrorMsg('Could not sign in with Google right now.');
        }
        return;
      } catch (err: any) {
        if (err?.code === 'SIGN_IN_CANCELLED' || err?.code === '12501') {
          setSubmitting(false);
          return;
        }
        console.warn('Native Google Sign-In failed, falling back to browser OAuth:', err);
      }
    }

    const redirectUri = getOAuthRedirectUri();
    const authUrl = cloudDatabase.getOAuthAuthorizeUrl('google', redirectUri);

    if (!authUrl) {
      setSubmitting(false);
      setErrorMsg('Supabase URL is not configured yet.');
      return;
    }

    try {
      await Linking.openURL(authUrl);
    } catch (e) {
      console.warn('Could not open OAuth URL:', e);
      setErrorMsg('Could not launch browser for sign-in.');
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={28} color={theme.primaryLight} />
          </View>

          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>
            Sign in with Google to back up your workout streak and compete with friends on the leaderboard.
          </Text>

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          <TouchableOpacity
            style={styles.oauthGoogleBtn}
            onPress={handleGoogleSignIn}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={theme.onPrimary} />
                <Text style={styles.oauthBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
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
    marginBottom: 20,
    lineHeight: 19,
  },
  oauthGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  oauthBtnText: {
    color: theme.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  errorText: {
    color: theme.danger,
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
});
