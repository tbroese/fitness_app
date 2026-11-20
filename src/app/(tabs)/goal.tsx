import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFitness } from '../../context/FitnessContext';
import { GymReportType } from '../../services/cloud';
import { BackgroundLocationModal } from '../../components/BackgroundLocationModal';
import {
  getCurrentCoordinates,
  requestLocationPermissions,
  setupGymGeofence,
  calculateDistanceMeters,
} from '../../services/locationService';
import { AppTheme } from '../../constants/theme';
import { VERIFIED_GYMS, VerifiedGym } from '../../constants/verifiedGyms';
import { getIsoWeekId } from '../../utils/dateUtils';
import { FIXED_DWELL_MINUTES, DEFAULT_GEOFENCE_RADIUS_METERS } from '../../types/fitness';

type GymSetupMode = 'existing' | 'custom';

export default function GoalSetupScreen() {
  const {
    userProfile,
    preferences,
    workouts,
    permissionStatus,
    setWeeklyGoal,
    scheduleGoalForMonday,
    cancelPendingGoal,
    updateGymLocation,
    setAutoDetectGym,
    requestAutoTrackingPermission,
    searchExistingGyms,
    submitGymReport,
    theme,
    distanceUnit,
    fontScale,
  } = useFitness();

  const styles = useMemo(() => createStyles(theme, fontScale), [theme, fontScale]);

  const [bgLocationModalVisible, setBgLocationModalVisible] = useState(false);

  const isAutoTrackingOn = preferences.autoDetectGym && permissionStatus.backgroundGranted;

  const handleToggleAutoTracking = async () => {
    if (isAutoTrackingOn) {
      await setAutoDetectGym(false);
      return;
    }
    if (permissionStatus.backgroundGranted) {
      await setAutoDetectGym(true);
      return;
    }
    setBgLocationModalVisible(true);
  };

  const { scrollTo, t } = useLocalSearchParams<{ scrollTo?: string; t?: string }>();
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const pendingScrollTargetRef = useRef<'top' | 'bottom' | null>(null);

  const initialMatchedVerified = preferences.gymLocation
    ? VERIFIED_GYMS.find(
      (g) =>
        g.id === preferences.gymLocation?.id ||
        g.name.toLowerCase() === preferences.gymLocation?.name.toLowerCase()
    ) || null
    : null;

  const isSavedCustomGym = Boolean(preferences.gymLocation && !initialMatchedVerified);

  const [selectedGoal, setSelectedGoal] = useState<number>(preferences.weeklyGoal);
  const [gymMode, setGymMode] = useState<GymSetupMode>(
    isSavedCustomGym ? 'custom' : 'existing'
  );

  // State for "Add Existing Gym"
  const [searchQuery, setSearchQuery] = useState<string>(
    initialMatchedVerified ? initialMatchedVerified.name : ''
  );
  const [selectedVerifiedGym, setSelectedVerifiedGym] = useState<VerifiedGym | null>(
    initialMatchedVerified
  );
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(true);
  const [existingGymsResults, setExistingGymsResults] = useState<VerifiedGym[]>(VERIFIED_GYMS);
  const [isSearchingGyms, setIsSearchingGyms] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportType, setReportType] = useState<GymReportType>('moved');
  const [reportGymName, setReportGymName] = useState('');
  const [reportAddress, setReportAddress] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [reportCoords, setReportCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [submittingReport, setSubmittingReport] = useState(false);

  // State for "Add Custom Gym" (never pre-filled from verified gyms)
  const [gymName, setGymName] = useState<string>(
    isSavedCustomGym && preferences.gymLocation ? preferences.gymLocation.name : ''
  );
  const [lat, setLat] = useState<string>(
    isSavedCustomGym && preferences.gymLocation ? String(preferences.gymLocation.latitude) : ''
  );
  const [lon, setLon] = useState<string>(
    isSavedCustomGym && preferences.gymLocation ? String(preferences.gymLocation.longitude) : ''
  );
  const [isManualCustomGym, setIsManualCustomGym] = useState<boolean>(
    isSavedCustomGym && preferences.gymLocation
      ? Boolean(preferences.gymLocation.isManual)
      : true
  );
  const [isLocating, setIsLocating] = useState(false);

  // Sync selected goal with current active weekly goal
  useEffect(() => {
    setSelectedGoal(preferences.weeklyGoal);
  }, [preferences.weeklyGoal]);

  // Sync gym fields when saved gymLocation changes
  useEffect(() => {
    if (!preferences.gymLocation) return;

    const matchedVerified = VERIFIED_GYMS.find(
      (g) =>
        g.id === preferences.gymLocation?.id ||
        g.name.toLowerCase() === preferences.gymLocation?.name.toLowerCase()
    );

    if (matchedVerified) {
      setGymMode('existing');
      setSelectedVerifiedGym(matchedVerified);
      setSearchQuery(matchedVerified.name);
    } else if (preferences.gymLocation.isVerified) {
      const savedExisting: VerifiedGym = {
        id: preferences.gymLocation.id,
        name: preferences.gymLocation.name,
        address: preferences.gymLocation.address || '',
        latitude: preferences.gymLocation.latitude,
        longitude: preferences.gymLocation.longitude,
      };
      setGymMode('existing');
      setSelectedVerifiedGym(savedExisting);
      setSearchQuery(savedExisting.name);
    } else {
      setGymMode('custom');
      setGymName(preferences.gymLocation.name);
      setLat(String(preferences.gymLocation.latitude));
      setLon(String(preferences.gymLocation.longitude));
      setIsManualCustomGym(Boolean(preferences.gymLocation.isManual));
    }
  }, [preferences.gymLocation]);

  // Scroll to Gym Location (top) or Weekly Goal (bottom) when navigated from Streak tab gear icons
  useEffect(() => {
    if (scrollTo === 'gym') {
      pendingScrollTargetRef.current = 'top';
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        pendingScrollTargetRef.current = null;
      }, 150);
      return () => clearTimeout(timer);
    }
    if (scrollTo === 'goal') {
      pendingScrollTargetRef.current = 'bottom';
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        pendingScrollTargetRef.current = null;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [scrollTo, t]);

  const goalOptions = [1, 2, 3, 4, 5, 6, 7];
  const currentWeekId = getIsoWeekId(new Date());
  const signupWeekId = userProfile.createdAt
    ? getIsoWeekId(new Date(userProfile.createdAt))
    : currentWeekId;
  const isFirstWeek = currentWeekId === signupWeekId;

  const handleSelectGoal = async (newGoal: number) => {
    if (newGoal === preferences.weeklyGoal) return;

    // Check if today is Monday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const isMonday = new Date().getDay() === 1;
    const isBeforeFirstWorkout = workouts.length === 0;

    // Allow immediate goal setup before first workout; afterward mid-week changes start Monday
    if (!isMonday && !isBeforeFirstWorkout) {
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

    // On Monday (or before first workout), update immediately
    setSelectedGoal(newGoal);
    await setWeeklyGoal(newGoal);
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

  // Silently read user coordinates ONLY if foreground location permission is already granted
  useEffect(() => {
    if (!permissionStatus.foregroundGranted) return;
    let cancelled = false;
    getCurrentCoordinates().then((coords) => {
      if (!cancelled && coords) {
        setUserCoords(coords);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [permissionStatus.foregroundGranted]);

  useEffect(() => {
    if (gymMode !== 'existing') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingGyms(true);
      try {
        const results = await searchExistingGyms(searchQuery, userCoords);
        if (!cancelled) {
          setExistingGymsResults(results);
        }
      } finally {
        if (!cancelled) {
          setIsSearchingGyms(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gymMode, searchQuery, userCoords, searchExistingGyms]);

  const filteredVerifiedGyms = existingGymsResults;

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setDropdownOpen(true);
    if (
      selectedVerifiedGym &&
      text.trim().toLowerCase() !== selectedVerifiedGym.name.toLowerCase()
    ) {
      setSelectedVerifiedGym(null);
    }
  };

  const handleSelectVerifiedGym = (gym: VerifiedGym) => {
    setSelectedVerifiedGym(gym);
    setSearchQuery(gym.name);
    setDropdownOpen(false);
  };

  const openReportModal = () => {
    const prefillName = selectedVerifiedGym?.name || searchQuery.trim();
    setReportType(selectedVerifiedGym ? 'moved' : 'missing');
    setReportGymName(prefillName);
    setReportAddress('');
    setReportNotes('');
    setReportCoords(userCoords);
    setReportModalVisible(true);
  };

  const handleAttachReportLocation = async () => {
    const { foregroundGranted } = await requestLocationPermissions(false);
    if (!foregroundGranted) {
      Alert.alert('Location Needed', 'Allow location access to attach your current GPS coordinates.');
      return;
    }
    const coords = await getCurrentCoordinates();
    if (coords) {
      setReportCoords(coords);
      setUserCoords(coords);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportGymName.trim()) {
      Alert.alert('Gym Name Required', 'Please enter the name of the gym.');
      return;
    }
    setSubmittingReport(true);
    try {
      const ok = await submitGymReport({
        gymId: selectedVerifiedGym?.id || null,
        gymName: reportGymName.trim(),
        reportType,
        suggestedAddress: reportAddress.trim(),
        latitude: reportCoords?.latitude ?? null,
        longitude: reportCoords?.longitude ?? null,
        notes: reportNotes.trim(),
      });
      if (ok) {
        setReportModalVisible(false);
        Alert.alert(
          'Report Submitted',
          'Thanks! We will review and update the gym directory. You can use Add Custom Gym in the meantime.'
        );
      } else {
        Alert.alert('Upload Failed', 'Could not submit report right now. Please try again.');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSaveGym = async () => {
    if (gymMode === 'existing') {
      const gymToSave =
        selectedVerifiedGym ||
        existingGymsResults.find(
          (g) => g.name.toLowerCase() === searchQuery.trim().toLowerCase()
        ) ||
        VERIFIED_GYMS.find(
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
        isVerified: true,
        latitude: gymToSave.latitude,
        longitude: gymToSave.longitude,
        radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS, // Default 150m
        dwellMinutesRequired: FIXED_DWELL_MINUTES, // Fixed at 15m
      };

      await updateGymLocation(newGym);
      setupGymGeofence(newGym);

      if (!permissionStatus.backgroundGranted) {
        setBgLocationModalVisible(true);
      } else {
        Alert.alert('Saved!', `Gym "${newGym.name}" has been configured.`);
      }
      return;
    }

    if (isManualCustomGym) {
      const trimmedName = gymName.trim();
      if (!trimmedName) {
        Alert.alert('Gym Name Required', "Please enter a name for your gym (e.g. Alex's Home Gym).");
        return;
      }

      const newGym = {
        id:
          preferences.gymLocation && !preferences.gymLocation.isVerified
            ? preferences.gymLocation.id
            : `gym_${Date.now()}`,
        name: trimmedName,
        isVerified: false,
        isManual: true,
        latitude: 0,
        longitude: 0,
        radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
        dwellMinutesRequired: FIXED_DWELL_MINUTES,
      };

      await updateGymLocation(newGym);
      Alert.alert(
        'Saved!',
        `Manual gym "${newGym.name}" configured. Use Check In / Check Out on the Streak tab (auto-checkout after 180 mins).`
      );
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
        preferences.gymLocation && !preferences.gymLocation.isVerified
          ? preferences.gymLocation.id
          : `gym_${Date.now()}`,
      name: gymName.trim() || 'My Gym',
      isVerified: false,
      latitude: parsedLat,
      longitude: parsedLon,
      radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS, // Default 150m
      dwellMinutesRequired: FIXED_DWELL_MINUTES, // Fixed at 15m
    };

    await updateGymLocation(newGym);
    setupGymGeofence(newGym);

    if (!permissionStatus.backgroundGranted) {
      setBgLocationModalVisible(true);
    } else {
      Alert.alert('Saved!', `Gym "${newGym.name}" has been configured.`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (pendingScrollTargetRef.current === 'top') {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            pendingScrollTargetRef.current = null;
          } else if (pendingScrollTargetRef.current === 'bottom') {
            scrollViewRef.current?.scrollToEnd({ animated: true });
            pendingScrollTargetRef.current = null;
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
            Choose a verified gym or add a custom gym. The app will automatically detect your arrival and verify your workout when you stay for {FIXED_DWELL_MINUTES} minutes.
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
                color={gymMode === 'existing' ? theme.onPrimary : theme.textSecondary}
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
                color={gymMode === 'custom' ? theme.onPrimary : theme.textSecondary}
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
              <View style={[styles.impactHintPill, styles.impactHintPillVerified]}>
                <Ionicons name="shield-checkmark-outline" size={14} color={theme.successLight} />
                <Text style={[styles.impactHintText, styles.impactHintTextVerified]}>
                  Counts on Global, Gym & Friends
                </Text>
              </View>
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
                      setSelectedVerifiedGym(null);
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

              {/* Dropdown of matching existing gyms (up to 3 at a time) */}
              {dropdownOpen && (
                <View style={styles.dropdownList}>
                  {filteredVerifiedGyms.length > 0 ? (
                    filteredVerifiedGyms.slice(0, 3).map((gym) => {
                      const isSelected = selectedVerifiedGym?.id === gym.id;
                      return (
                        <TouchableOpacity
                          key={gym.id}
                          style={[
                            styles.dropdownItem,
                            isSelected && styles.dropdownItemSelected,
                          ]}
                          onPress={() => handleSelectVerifiedGym(gym)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.dropdownItemIcon}>
                            <Ionicons
                              name="barbell-outline"
                              size={15}
                              color={isSelected ? theme.primaryLight : theme.textSecondary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.dropdownGymName} numberOfLines={1}>
                              {gym.name}
                            </Text>
                            <Text style={styles.dropdownGymAddress} numberOfLines={1}>
                              {userCoords
                                ? `${(
                                    calculateDistanceMeters(
                                      userCoords.latitude,
                                      userCoords.longitude,
                                      gym.latitude,
                                      gym.longitude
                                    ) / (distanceUnit === 'mi' ? 1609.344 : 1000)
                                  ).toFixed(1)} ${distanceUnit} away • ${gym.address}`
                                : gym.address}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={theme.primaryLight}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.dropdownEmpty}>
                      <Text style={styles.dropdownEmptyText}>
                        {isSearchingGyms ? 'Searching gyms...' : 'No matching existing gyms found.'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Selected Verified Gym Summary (Coordinates hidden & locked) */}
              {selectedVerifiedGym && (
                <View style={styles.selectedVerifiedCard}>
                  <Ionicons name="checkmark-circle" size={22} color={theme.successLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedVerifiedName}>
                      {selectedVerifiedGym.name}
                    </Text>
                    <Text style={styles.selectedVerifiedAddress}>
                      {selectedVerifiedGym.address}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.reportLinkBtn}
                onPress={openReportModal}
                activeOpacity={0.75}
              >
                <Ionicons name="flag-outline" size={14} color={theme.textTertiary} />
                <Text style={styles.reportLinkText}>
                  Wrong address or missing gym? Report it
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={[styles.impactHintPill, styles.impactHintPillCustom]}>
                <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.impactHintText, styles.impactHintTextCustom]}>
                  Counts on Personal & Friends only
                </Text>
              </View>
              {/* Gym Name */}
              <Text style={styles.fieldLabel}>Gym Name</Text>
              <TextInput
                style={styles.input}
                value={gymName}
                onChangeText={setGymName}
                placeholder="e.g. Alex's Home Gym"
                placeholderTextColor={theme.textTertiary}
              />

              {/* Tracking Method Toggle: Manual Check-In/Out (default, left) vs GPS Location */}
              <Text style={styles.fieldLabel}>Tracking Method</Text>
              <View style={[styles.modeToggleRow, { marginBottom: 8 }]}>
                <TouchableOpacity
                  style={[
                    styles.modeToggleBtn,
                    isManualCustomGym && styles.modeToggleBtnActive,
                  ]}
                  onPress={() => setIsManualCustomGym(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="hand-left-outline"
                    size={15}
                    color={isManualCustomGym ? theme.onPrimary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modeToggleText,
                      isManualCustomGym && styles.modeToggleTextActive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    Manual Check-In / Out
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeToggleBtn,
                    !isManualCustomGym && styles.modeToggleBtnActive,
                  ]}
                  onPress={() => setIsManualCustomGym(false)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="location-outline"
                    size={15}
                    color={!isManualCustomGym ? theme.onPrimary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modeToggleText,
                      !isManualCustomGym && styles.modeToggleTextActive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    GPS Location
                  </Text>
                </TouchableOpacity>
              </View>

              {isManualCustomGym ? (
                <View style={styles.manualHintBox}>
                  <Ionicons name="home-outline" size={16} color={theme.primaryLight} />
                  <Text style={styles.manualHintText}>
                    For home gyms and other gyms where location tracking won't work. Check in and check out manually on the Streak tab (auto-checkouts after 180 mins).
                  </Text>
                </View>
              ) : (
                <View>
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
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGym}>
            <Ionicons name="save-outline" size={18} color={theme.onPrimary} />
            <Text style={styles.saveBtnText}>Save Gym Settings</Text>
          </TouchableOpacity>

          {/* Auto-Tracking Status Toggle (GPS gyms only) */}
          {!(gymMode === 'custom' && isManualCustomGym) && !preferences.gymLocation?.isManual && (
            <TouchableOpacity
              style={styles.autoTrackRow}
              onPress={handleToggleAutoTracking}
              activeOpacity={0.85}
            >
            <View style={{ flex: 1 }}>
              <Text style={styles.autoTrackTitle}>Auto-Tracking (Hands-Free)</Text>
              <Text style={styles.autoTrackSub}>
                {isAutoTrackingOn
                  ? 'Active • Tap to switch to manual check-in'
                  : permissionStatus.backgroundGranted
                  ? 'Manual Check-In • Tap to enable Auto-Tracking'
                  : permissionStatus.foregroundGranted
                  ? 'Foreground-only • Tap to select "Allow all the time"'
                  : 'Off • Tap to enable location tracking'}
              </Text>
            </View>
            <Switch
              value={isAutoTrackingOn}
              onValueChange={handleToggleAutoTracking}
              trackColor={{ false: theme.cardBorder, true: theme.success }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>
          )}
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

          {isFirstWeek && (
            <View style={[styles.manualHintBox, { marginBottom: 12 }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.primaryLight} />
              <Text style={styles.manualHintText}>
                First-week grace: Your target this week is capped to the days remaining since you joined (min 1), and you can set your goal immediately before your first workout.
              </Text>
            </View>
          )}

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

      <BackgroundLocationModal
        visible={bgLocationModalVisible}
        onContinue={async () => {
          setBgLocationModalVisible(false);
          await setAutoDetectGym(true);
          await requestAutoTrackingPermission();
        }}
        onUseForegroundOnly={async () => {
          setBgLocationModalVisible(false);
          await setAutoDetectGym(false);
          if (!permissionStatus.foregroundGranted) {
            await requestLocationPermissions(false);
          }
        }}
      />

      {/* Report Gym Issue / Missing Gym Modal */}
      <Modal
        visible={reportModalVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.reportModalOverlay}
        >
          <View style={styles.reportModalCard}>
            <View style={styles.reportModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="flag-outline" size={20} color={theme.primaryLight} />
                <Text style={styles.reportModalTitle}>Report Gym Issue</Text>
              </View>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Issue Type</Text>
            <View style={styles.modeToggleRow}>
              {(
                [
                  { key: 'moved', label: 'Moved' },
                  { key: 'closed', label: 'Closed' },
                  { key: 'missing', label: 'Missing' },
                ] as const
              ).map((opt) => {
                const active = reportType === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.modeToggleBtn, active && styles.modeToggleBtnActive]}
                    onPress={() => setReportType(opt.key)}
                  >
                    <Text
                      style={[
                        styles.modeToggleText,
                        active && styles.modeToggleTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Gym Name</Text>
            <TextInput
              style={styles.input}
              value={reportGymName}
              onChangeText={setReportGymName}
              placeholder="e.g. Powerhouse Gym Torrance"
              placeholderTextColor={theme.textTertiary}
            />

            <Text style={styles.fieldLabel}>Correct / New Address (Optional)</Text>
            <TextInput
              style={styles.input}
              value={reportAddress}
              onChangeText={setReportAddress}
              placeholder="e.g. 5130 W 190th St, Torrance, CA"
              placeholderTextColor={theme.textTertiary}
            />

            <TouchableOpacity
              style={styles.gpsDetectBtn}
              onPress={handleAttachReportLocation}
            >
              <Ionicons name="navigate" size={16} color={theme.primaryLight} />
              <Text style={styles.gpsDetectText}>
                {reportCoords
                  ? `GPS Attached (${reportCoords.latitude.toFixed(4)}, ${reportCoords.longitude.toFixed(4)})`
                  : 'Attach My Current GPS (Optional)'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Notes (Optional)</Text>
            <TextInput
              style={styles.input}
              value={reportNotes}
              onChangeText={setReportNotes}
              placeholder="Any extra details..."
              placeholderTextColor={theme.textTertiary}
            />

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSubmitReport}
              disabled={submittingReport}
            >
              {submittingReport ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme, fontScale: number = 1) => {
  const s = (size: number) => Math.round(size * fontScale);
  return StyleSheet.create({
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
    fontSize: s(18),
    fontWeight: '800',
    color: theme.textPrimary,
  },
  sectionDesc: {
    fontSize: s(13),
    color: theme.textSecondary,
    lineHeight: s(18),
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
    color: theme.onPrimary,
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
    color: 'rgba(255, 255, 255, 0.85)',
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
    fontSize: s(14),
    color: theme.textPrimary,
  },
  goalSummarySub: {
    fontSize: s(12),
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
    paddingHorizontal: 8,
    borderRadius: 9,
    overflow: 'hidden',
  },
  modeToggleBtnActive: {
    backgroundColor: theme.primary,
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
    flexShrink: 1,
  },
  modeToggleTextActive: {
    color: theme.onPrimary,
  },
  impactHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
  },
  impactHintPillVerified: {
    backgroundColor: theme.successMuted,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  impactHintPillCustom: {
    backgroundColor: theme.cardBackgroundSubtle,
    borderColor: theme.cardBorder,
  },
  impactHintText: {
    fontSize: 11,
    fontWeight: '700',
  },
  impactHintTextVerified: {
    color: theme.successLight,
  },
  impactHintTextCustom: {
    color: theme.textSecondary,
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
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  dropdownItemSelected: {
    backgroundColor: theme.primaryMuted,
  },
  dropdownItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.cardBackgroundSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownGymName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  dropdownGymAddress: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 1,
  },
  dropdownEmpty: {
    padding: 16,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 13,
    color: theme.textTertiary,
  },
  selectedVerifiedCard: {
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
  selectedVerifiedName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  selectedVerifiedAddress: {
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
    borderColor: theme.primaryBorder,
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
    color: theme.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  autoTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  autoTrackTitle: {
    fontSize: s(13),
    fontWeight: '700',
    color: theme.textPrimary,
  },
  autoTrackSub: {
    fontSize: s(11),
    color: theme.textSecondary,
    marginTop: 2,
  },
  manualHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.cardBackgroundSubtle,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  manualHintText: {
    flex: 1,
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 17,
  },
  reportLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 4,
  },
  reportLinkText: {
    fontSize: 12,
    color: theme.textTertiary,
    fontWeight: '600',
  },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  reportModalCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reportModalTitle: {
    fontSize: s(17),
    fontWeight: '800',
    color: theme.textPrimary,
  },
});
};
