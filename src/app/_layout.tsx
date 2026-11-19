import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FitnessProvider, useFitness } from '../context/FitnessContext';

function RootNavigator() {
  const { theme, themeMode } = useFitness();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <FitnessProvider>
      <RootNavigator />
    </FitnessProvider>
  );
}
