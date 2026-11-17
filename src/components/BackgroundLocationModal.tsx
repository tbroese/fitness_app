import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

interface BackgroundLocationModalProps {
  visible: boolean;
  onContinue: () => void;
  onUseForegroundOnly: () => void;
}

export const BackgroundLocationModal: React.FC<BackgroundLocationModalProps> = ({
  visible,
  onContinue,
  onUseForegroundOnly,
}) => {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="navigate-circle-outline" size={30} color={theme.primaryLight} />
          </View>

          <Text style={styles.title}>Enable Auto-Tracking</Text>
          <Text style={styles.subtitle}>
            Inertia collects location data in the background to automatically detect when you arrive at your gym and stay for 15 minutes — even when the app is closed.
          </Text>

          <View style={styles.tipBox}>
            <Ionicons name="checkmark-circle-outline" size={18} color={theme.successLight} />
            <Text style={styles.tipText}>
              On the next screen, select{' '}
              <Text style={styles.tipBold}>Allow all the time</Text> so Auto-Tracking stays active.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Enable Auto-Tracking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onUseForegroundOnly}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>
              Keep Foreground-Only (Manual Check-In)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 19,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.successMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: theme.textPrimary,
    lineHeight: 17,
  },
  tipBold: {
    fontWeight: '800',
    color: theme.successLight,
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: theme.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryBtnText: {
    color: theme.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});
