import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { GymLocation, DEFAULT_GEOFENCE_RADIUS_METERS } from '../types/fitness';
import { storageService } from './storageService';

export const GEOFENCE_TASK_NAME = 'GYM_GEOFENCE_TASK';

// Define the background geofence task synchronously at module global scope
// This is strictly required by Expo TaskManager before any components mount.
// It persists dwell entry/exit directly to AsyncStorage so background check-ins work even when the app UI is closed.
try {
  if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
    TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.error('Geofence task error:', error);
        return;
      }
      if (data) {
        const { eventType, region } = data as any;
        if (eventType === Location.GeofencingEventType.Enter) {
          console.log(`[Geofence] Entered gym region: ${region?.identifier}`);
          await storageService.handleBackgroundGeofenceEnter(region?.identifier);
        } else if (eventType === Location.GeofencingEventType.Exit) {
          console.log(`[Geofence] Exited gym region: ${region?.identifier}`);
          await storageService.handleBackgroundGeofenceExit();
        }
      }
    });
  }
} catch (e) {
  console.warn('Could not register TaskManager task globally:', e);
}

/**
 * Calculates distance in meters between two coordinates using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Checks if coordinate is within gym perimeter
 */
export function isInsideGym(
  currentLat: number,
  currentLon: number,
  gym: GymLocation
): boolean {
  const radius = gym.radiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;
  const distance = calculateDistanceMeters(currentLat, currentLon, gym.latitude, gym.longitude);
  return distance <= radius;
}

/**
 * Request location permissions (Foreground and Background)
 */
export async function requestLocationPermissions(): Promise<{
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    let bgGranted = false;
    if (fg.granted) {
      try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        bgGranted = bg.granted;
      } catch (bgErr) {
        // Expo Go on Android does not support background location, but foreground works great
        console.log('Background location not supported in this runtime (Expo Go):', bgErr);
      }
    }
    return {
      foregroundGranted: fg.granted,
      backgroundGranted: bgGranted,
    };
  } catch (error) {
    console.warn('Error requesting location permissions:', error);
    return { foregroundGranted: false, backgroundGranted: false };
  }
}

/**
 * Get current device location
 */
export async function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  } catch (error) {
    console.warn('Failed to get current location:', error);
    return null;
  }
}

/**
 * Subscribe to continuous location updates when app is open
 */
export async function subscribeToLocationUpdates(
  callback: (coords: { latitude: number; longitude: number }) => void
): Promise<Location.LocationSubscription | null> {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) {
      const req = await Location.requestForegroundPermissionsAsync();
      if (!req.granted) return null;
    }

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000, // check every 3 seconds while active
        distanceInterval: 5, // or every 5 meters
      },
      (loc) => {
        callback({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    );
    return sub;
  } catch (e) {
    console.warn('watchPositionAsync not available:', e);
    return null;
  }
}

/**
 * Setup geofence monitoring with expo-location
 */
export async function setupGymGeofence(gym: GymLocation): Promise<boolean> {
  try {
    const isAvailable = await Location.hasServicesEnabledAsync();
    if (!isAvailable) return false;

    const radius = gym.radiusMeters || DEFAULT_GEOFENCE_RADIUS_METERS;

    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
      {
        identifier: gym.name,
        latitude: gym.latitude,
        longitude: gym.longitude,
        radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);

    return true;
  } catch (err) {
    // Note: Expo Go on Android does not support startGeofencingAsync, but foreground location watching handles it cleanly
    console.log('Background geofencing unavailable in current runtime (handled via live location watcher):', err);
    return false;
  }
}
