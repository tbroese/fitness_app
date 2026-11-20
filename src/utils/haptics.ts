import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

export function triggerLightHaptic(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function triggerSuccessHaptic(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function triggerSelectionHaptic(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}
