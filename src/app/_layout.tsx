import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FitnessProvider } from '../context/FitnessContext';
import { theme } from '../constants/theme';

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FitnessProvider>
        <StatusBar style="light" />
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
      </FitnessProvider>
    </View>
  );
}
