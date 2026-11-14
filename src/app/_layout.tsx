import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FitnessProvider } from '../context/FitnessContext';

export default function RootLayout() {
  return (
    <FitnessProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </FitnessProvider>
  );
}
