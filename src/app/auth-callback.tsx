import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useFitness } from '../context/FitnessContext';
import { theme } from '../constants/theme';

export default function AuthCallbackScreen() {
  const { handleOAuthRedirectUrl } = useFitness();
  const currentUrl = Linking.useURL();

  useEffect(() => {
    let mounted = true;

    async function completeAuth() {
      if (currentUrl) {
        await handleOAuthRedirectUrl(currentUrl);
      } else {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          await handleOAuthRedirectUrl(initialUrl);
        }
      }

      if (mounted) {
        router.replace('/');
      }
    }

    completeAuth();

    return () => {
      mounted = false;
    };
  }, [currentUrl, handleOAuthRedirectUrl]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.primaryLight} />
      <Text style={styles.text}>Completing sign-in...</Text>
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
