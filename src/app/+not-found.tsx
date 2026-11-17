import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { router, usePathname } from 'expo-router';
import { useFitness } from '../context/FitnessContext';
import { theme } from '../constants/theme';

/**
 * Catches OAuth callback deep links on React Native where `#access_token=...`
 * fragments are included in the path by the OS, completes sign-in, and returns home.
 */
export default function NotFoundOrAuthRedirectScreen() {
  const { handleOAuthRedirectUrl } = useFitness();
  const currentUrl = Linking.useURL();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    async function processRedirect() {
      const candidate = currentUrl || pathname || (await Linking.getInitialURL()) || '';
      if (
        candidate.includes('access_token=') ||
        candidate.includes('error_description=') ||
        candidate.includes('auth-callback')
      ) {
        await handleOAuthRedirectUrl(candidate);
      }

      if (mounted) {
        router.replace('/');
      }
    }

    processRedirect();

    return () => {
      mounted = false;
    };
  }, [currentUrl, pathname, handleOAuthRedirectUrl]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.primaryLight} />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  text: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
