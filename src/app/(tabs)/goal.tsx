import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import {
  getCurrentCoordinates,
  requestLocationPermissions,
  setupGymGeofence,
} from '../../services/locationService';
import { theme } from '../../constants/theme';
import { PARTNERED_GYMS, PartneredGym } from '../../constants/partneredGyms';
import { FIXED_DWELL_MINUTES, DEFAULT_GEOFENCE_RADIUS_METERS } from '../../types/fitness';

type GymSetupMode = 'existing' | 'custom';

export default function GoalSetupScreen() {
  const {
    preferences,
    setWeeklyGoal,
    scheduleGoalForMonday,
    cancelPendingGoal,
    updateGymLocation,
  } = useFitness();

  const { scrollTo, t } = useLocalSearchParams<{ scrollTo?: string; t?: string }>();
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const pendingScrollToBottomRef = useRef(false);

  const initialMatchedPartner = preferences.gymLocation
    ? PARTNERED_GYMS.find(
        (g) =>
          g.id === preferences.gymLocation?.id ||
          g.name.toLowerCase() === preferences.gymLocation?.name.toLowerCase()
      ) || null
    : null;

  const isSavedCustomGym = Boolean(preferences.gymLocation && !initialMatchedPartner);

  const [selectedGoal, setSelectedGoal] = useState<number>(preferences.weeklyGoal);
  const [gymMode, setGymMode] = useState<GymSetupMode>(
    isSavedCustomGym ? 'custom' : 'existing'
  );

  // State for "Add Existing Gym"
  const [searchQuery, setSearchQuery] = useState<string>(
    initialMatchedPartner ? initialMatchedPartner.name : ''
  );
  const [selectedPartnerGym, setSelectedPartnerGym] = useState<PartneredGym | null>(
    initialMatchedPartner
  );
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(true);

  // State for "Add Custom Gym" (never pre-filled from partnered gyms)
  const [gymName, setGymName] = useState<string>(
    isSavedCustomGym && preferences.gymLocation ? preferences.gymLocation.name : ''
  );
  const [lat, setLat] = useState<string>(
    isSavedCustomGym && preferences.gymLocation ? String(preferences.gymLocation.latitude) : ''
  );
  const [lon, setLon] = useState<string>(
    isSavedCustomGym && preferences.gymLocation ? String(preferences.gymLocation.longitude) : ''
  );
  const [isLocating, setIsLocating] = useState(false);

  // Sync selected goal with current active weekly goal
  useEffect(() => {
    setSelectedGoal(preferences.weeklyGoal);
  }, [preferences.weeklyGoal]);

  // Sync gym fields when saved gymLocation changes
  useEffect(() => {
    if (!preferences.gymLocation) return;

    const matchedPartner = PARTNERED_GYMS.find(
      (g) =>
        g.id === preferences.gymLocation?.id ||
        g.name.toLowerCase() === preferences.gymLocation?.name.toLowerCase()
    );

    if (matchedPartner) {
      setGymMode('existing');
      setSelectedPartnerGym(matchedPartner);
      setSearchQuery(matchedPartner.name);
    } else {
      setGymMode('custom');
      setGymName(preferences.gymLocation.name);
      setLat(String(preferences.gymLocation.latitude));
      setLon(String(preferences.gymLocation.longitude));
    }
  }, [preferences.gymLocation]);

  // Ensure top of page (Gym Location box) is visible when navigated from "Setup Gym Location" box
  useEffect(() => {
    if (scrollTo === 'gym') {
      pendingScrollToBottomRef.current = true;
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        pendingScrollToBottomRef.current = false;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [scrollTo, t]);

  const goalOptions = [1, 2, 3, 4, 5, 6, 7];

  const handleSelectGoal = async (newGoal: number) => {
    if (newGoal === preferences.weeklyGoal) return;

    // Check if today is Monday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const isMonday = new Date().getDay() === 1;

    // Mid-week adjustment is strictly disallowed: only Cancel or Update Starting Monday
    if (!isMonday) {
      Alert.alert(
        'Mid-Week Adjustment Not Allowed',
        `Weekly goals cannot be changed mid-week. You can keep your current goal of ${preferences.weeklyGoal} workout(s) this week or schedule this update to start next Monday.\n\nWould you like to update your goal to ${newGoal} workout(s) starting next Monday?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Update Starting Monday',
            style: 'default',
            onPress: async () => {
              await scheduleGoalForMonday(newGoal);
              Alert.alert(
                'Goal Scheduled',
                `Your goal will update to ${newGoal} workout(s)/week starting next Monday.`
              );
            },
          },
        ]
      );
      return;
    }

    // On Monday, update immediately for the new week
    setSelectedGoal(newGoal);
    await setWeeklyGoal(newGoal);
    Alert.alert('Goal Updated', `Your weekly goal is now ${newGoal} workout(s)/week.`);
  };

  const handleCancelPending = async () => {
    await cancelPendingGoal();
    Alert.alert('Canceled', 'The scheduled Monday goal change has been canceled.');
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { foregroundGranted } = await requestLocationPermissions();
      if (!foregroundGranted) {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access to automatically configure your gym coordinates.'
        );
        setIsLocating(false);
        return;
      }

      const coords = await getCurrentCoordinates();
      if (coords) {
        setLat(coords.latitude.toFixed(6));
        setLon(coords.longitude.toFixed(6));
        Alert.alert(
          'Location Detected',
          `Captured coordinates:\nLatitude: ${coords.latitude.toFixed(4)}\nLongitude: ${coords.longitude.toFixed(4)}`
        );
      } else {
        Alert.alert('Error', 'Could not retrieve your current location.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to retrieve location.');
    } finally {
      setIsLocating(false);
    }
  };

  const filteredPartnerGyms = PARTNERED_GYMS.filter((gym) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      gym.name.toLowerCase().includes(q) ||
      gym.address.toLowerCase().includes(q)
    );
  });

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setDropdownOpen(true);
    if (
      selectedPartnerGym &&
      text.trim().toLowerCase() !== selectedPartnerGym.name.toLowerCase()
    ) {
      setSelectedPartnerGym(null);
    }
  };

  const handleSelectPartnerGym = (gym: PartneredGym) => {
    setSelectedPartnerGym(gym);
    setSearchQuery(gym.name);
    setDropdownOpen(false);
  };

  const handleSaveGym = async () => {
    if (gymMode === 'existing') {
      const gymToSave =
        selectedPartnerGym ||
        PARTNERED_GYMS.find(
          (g) => g.name.toLowerCase() === searchQuery.trim().toLowerCase()
        );

      if (!gymToSave) {
        Alert.alert(
          'Select an Existing Gym',
          'Please select a gym from the dropdown list.'
        );
        return;
      }

      const newGym = {
        id: gymToSave.id,
        name: gymToSave.name,
        address: gymToSave.address,
        isPartnered: true,
        latitude: gymToSave.latitude,
        longitude: gymToSave.longitude,
        radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS, // Fixed at 300m
        dwellMinutesRequired: FIXED_DWELL_MINUTES, // Fixed at 15m
      };

      await updateGymLocation(newGym);
      setupGymGeofence(newGym);

      Alert.alert('Saved!', `Gym "${newGym.name}" has been configured.`);
      return;
    }

    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid numerical latitude and longitude.');
      return;
    }

    const newGym = {
      id:
        preferences.gymLocation && !preferences.gymLocation.isPartnered
          ? preferences.gymLocation.id
          : `gym_${Date.now()}`,
      name: gymName.trim() || 'My Gym',
      isPartnered: false,
      latitude: parsedLat,
      longitude: parsedLon,
      radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS, // Fixed at 300m
      dwellMinutesRequired: FIXED_DWELL_MINUTES, // Fixed at 15m
    };

    await updateGymLocation(newGym);
    setupGymGeofence(newGym);

    Alert.alert('Saved!', `Gym "${newGym.name}" has been configured.`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (pendingScrollToBottomRef.current) {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            pendingScrollToBottomRef.current = false;
          }
        }}
      >
        {/* Section 1: Gym Location Setup (Placed at top so keyboard never covers search) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={22} color={theme.primaryLight} />
            <Text style={styles.sectionTitle}>Gym Location</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Choose an existing partnered gym or add a custom gym. The app will automatically detect your arrival and verify your workout when you stay for {FIXED_DWELL_MINUTES} minutes.
          </Text>

          {/* 2 Options: Add Existing Gym vs Add Custom Gym */}
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                gymMode === 'existing' && styles.modeToggleBtnActive,
              ]}
              onPress={() => setGymMode('existing')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="business-outline"
                size={16}
                color={gymMode === 'existing' ? '#FFFFFF' : theme.textSecondary}
              />
              <Text
                style={[
                  styles.modeToggleText,
                  gymMode === 'existing' && styles.modeToggleTextActive,
                ]}
              >
                Add Existing Gym
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                gymMode === 'custom' && styles.modeToggleBtnActive,
              ]}
              onPress={() => setGymMode('custom')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={gymMode === 'custom' ? '#FFFFFF' : theme.textSecondary}
              />
              <Text
                style={[
                  styles.modeToggleText,
                  gymMode === 'custom' && styles.modeToggleTextActive,
                ]}
              >
                Add Custom Gym
              </Text>
            </TouchableOpacity>
          </View>

          {gymMode === 'existing' ? (
            <View>
              <Text style={styles.fieldLabel}>Search Existing Gyms</Text>
              <View style={styles.searchInputWrapper}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={theme.textSecondary}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Type gym name or city/address..."
                  placeholderTextColor={theme.textTertiary}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedPartnerGym(null);
                      setDropdownOpen(true);
                    }}
                    style={styles.clearSearchBtn}
                  >
                    <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setDropdownOpen((prev) => !prev)}
                  style={styles.dropdownToggleBtn}
                >
                  <Ionicons
                    name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Dropdown of matching existing gyms */}
              {dropdownOpen && (
                <View style={styles.dropdownList}>
                  {filteredPartnerGyms.length > 0 ? (
                    filteredPartnerGyms.map((gym) => {
                      const isSelected = selectedPartnerGym?.id === gym.id;
                      return (
                        <TouchableOpacity
                          key={gym.id}
                          style={[
                            styles.dropdownItem,
                            isSelected && styles.dropdownItemSelected,
                          ]}
                          onPress={() => handleSelectPartnerGym(gym)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.dropdownItemIcon}>
                            <Ionicons
                              name="barbell-outline"
                              size={18}
                              color={isSelected ? theme.primaryLight : theme.textSecondary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.dropdownGymName}>{gym.name}</Text>
                            <Text style={styles.dropdownGymAddress}>{gym.address}</Text>
                          </View>
                          {isSelected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color={theme.primaryLight}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.dropdownEmpty}>
                      <Text style={styles.dropdownEmptyText}>
                        No matching existing gyms found.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Selected Partnered Gym Summary (Coordinates hidden & locked) */}
              {selectedPartnerGym && (
                <View style={styles.selectedPartnerCard}>
                  <Ionicons name="checkmark-circle" size={22} color={theme.successLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedPartnerName}>
                      {selectedPartnerGym.name}
                    </Text>
                    <Text style={styles.selectedPartnerAddress}>
                      {selectedPartnerGym.address}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View>
              {/* Gym Name */}
              <Text style={styles.fieldLabel}>Gym Name</Text>
              <TextInput
                style={styles.input}
                value={gymName}
                onChangeText={setGymName}
                placeholder="e.g. Gold's Gym Downtown"
                placeholderTextColor={theme.textTertiary}
              />

              {/* Quick detect button */}
              <TouchableOpacity
                style={styles.gpsDetectBtn}
                onPress={handleUseCurrentLocation}
                disabled={isLocating}
              >
                <Ionicons name="navigate" size={16} color={theme.primaryLight} />
                <Text style={styles.gpsDetectText}>
                  {isLocating ? 'Detecting GPS...' : 'Set To Current Location'}
                </Text>
              </TouchableOpacity>

              {/* Coordinates */}
              <View style={styles.coordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Latitude</Text>
                  <TextInput
                    style={styles.input}
                    value={lat}
                    onChangeText={setLat}
                    keyboardType="numeric"
                    placeholder="37.7749"
                    placeholderTextColor={theme.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    value={lon}
                    onChangeText={setLon}
                    keyboardType="numeric"
                    placeholder="-122.4194"
                    placeholderTextColor={theme.textTertiary}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGym}>
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Save Gym Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Section 2: Weekly Goal */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy-outline" size={22} color={theme.primaryLight} />
            <Text style={styles.sectionTitle}>Weekly Workout Goal</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Select how many workouts you commit to each week. Goals can only be changed on Monday; mid-week requests take effect the following Monday.
          </Text>

          {/* Goal selection pills */}
          <View style={styles.goalRow}>
            {goalOptions.map((g) => {
              const isCurrent = preferences.weeklyGoal === g;
              const isPending = preferences.pendingWeeklyGoal === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.goalPill,
                    isCurrent && styles.goalPillSelected,
                    isPending && !isCurrent && styles.goalPillPending,
                  ]}
                  onPress={() => handleSelectGoal(g)}
                >
                  <Text
                    style={[
                      styles.goalPillText,
                      isCurrent && styles.goalPillTextSelected,
                      isPending && !isCurrent && styles.goalPillTextPending,
                    ]}
                  >
                    {g}
                  </Text>
                  <Text
                    style={[
                      styles.goalPillSub,
                      isCurrent && styles.goalPillSubSelected,
                      isPending && !isCurrent && styles.goalPillSubPending,
                    ]}
                  >
                    {isPending ? 'Next Mon' : g === 1 ? 'day' : 'days'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Scheduled Monday Goal Banner */}
          {preferences.pendingWeeklyGoal ? (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingTextCol}>
                <View style={styles.pendingHeaderRow}>
                  <Ionicons name="calendar" size={16} color={theme.warning} />
                  <Text style={styles.pendingTitle}>Update Scheduled for Monday</Text>
                </View>
                <Text style={styles.pendingSub}>
                  Your goal will change to {preferences.pendingWeeklyGoal} workouts/week starting next Monday.
                </Text>
              </View>
              <TouchableOpacity onPress={handleCancelPending} style={styles.cancelPendingBtn}>
                <Text style={styles.cancelPendingBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.goalSummaryBox}>
              <Text style={styles.goalSummaryText}>
                Active Goal: <Text style={{ fontWeight: '800', color: theme.primaryLight }}>{preferences.weeklyGoal} workout{preferences.weeklyGoal > 1 ? 's' : ''} per week</Text>
              </Text>
              <Text style={styles.goalSummarySub}>
                Mid-week changes take effect automatically the next Monday to protect your streak.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  sectionDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  goalPill: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  goalPillSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  goalPillPending: {
    borderColor: theme.warning,
    borderWidth: 1.5,
    backgroundColor: theme.warningMuted,
  },
  goalPillText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  goalPillTextSelected: {
    color: '#FFFFFF',
  },
  goalPillTextPending: {
    color: theme.warning,
  },
  goalPillSub: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 2,
  },
  goalPillSubSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  goalPillSubPending: {
    color: theme.warning,
    fontWeight: '700',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.warningMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  pendingTextCol: {
    flex: 1,
    marginRight: 10,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.warning,
  },
  pendingSub: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  cancelPendingBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cancelPendingBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.warning,
  },
  goalSummaryBox: {
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  goalSummaryText: {
    fontSize: 14,
    color: theme.textPrimary,
  },
  goalSummarySub: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 14,
    marginBottom: 6,
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 6,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  modeToggleBtnActive: {
    backgroundColor: theme.primary,
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.textPrimary,
  },
  clearSearchBtn: {
    padding: 4,
  },
  dropdownToggleBtn: {
    padding: 4,
    marginLeft: 2,
  },
  dropdownList: {
    marginTop: 8,
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  dropdownItemSelected: {
    backgroundColor: theme.primaryMuted,
  },
  dropdownItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.cardBackgroundSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownGymName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  dropdownGymAddress: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  dropdownEmpty: {
    padding: 16,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 13,
    color: theme.textTertiary,
  },
  selectedPartnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.successMuted,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  selectedPartnerName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  selectedPartnerAddress: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  input: {
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.textPrimary,
  },
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primaryMuted,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  gpsDetectText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryLight,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 22,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
