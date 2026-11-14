import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FitnessProvider } from '../context/FitnessContext';
import { theme } from '../constants/theme';

export default function RootLayout() {
  return (
    <FitnessProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </FitnessProvider>
  );
}
