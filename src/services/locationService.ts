import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { GymLocation } from '../types/fitness';

export const GEOFENCE_TASK_NAME = 'GYM_GEOFENCE_TASK';

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
  const distance = calculateDistanceMeters(currentLat, currentLon, gym.latitude, gym.longitude);
  return distance <= gym.radiusMeters;
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
      const bg = await Location.requestBackgroundPermissionsAsync();
      bgGranted = bg.granted;
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
      accuracy: Location.Accuracy.Balanced,
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
 * Setup geofence monitoring with expo-location
 */
export async function setupGymGeofence(gym: GymLocation): Promise<boolean> {
  try {
    const isAvailable = await Location.hasServicesEnabledAsync();
    if (!isAvailable) return false;

    const isTaskDefined = TaskManager.isTaskDefined(GEOFENCE_TASK_NAME);
    if (!isTaskDefined) {
      TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
        if (error) {
          console.error('Geofence task error:', error);
          return;
        }
        if (data) {
          const { eventType, region } = data as any;
          if (eventType === Location.GeofencingEventType.Enter) {
            console.log(`[Geofence] Entered gym region: ${region.identifier}`);
          } else if (eventType === Location.GeofencingEventType.Exit) {
            console.log(`[Geofence] Exited gym region: ${region.identifier}`);
          }
        }
      });
    }

    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
      {
        identifier: gym.name,
        latitude: gym.latitude,
        longitude: gym.longitude,
        radius: gym.radiusMeters,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);

    return true;
  } catch (err) {
    console.warn('Unable to register native geofencing task:', err);
    return false;
  }
}
