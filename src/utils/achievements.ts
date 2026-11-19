import { Ionicons } from '@expo/vector-icons';
import { StreakState, WorkoutSession } from '../types/fitness';
import { convertFromKg } from './weightUtils';

export interface AchievementItem {
  id: string;
  name: string;
  description: string;
  progressText: string;
  unlocked: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}

export function computeAchievements(params: {
  workouts: WorkoutSession[];
  streakState: StreakState;
  squatKg: number;
  benchKg: number;
  deadliftKg: number;
  friendsCount: number;
}): AchievementItem[] {
  const { workouts, streakState, squatKg, benchKg, deadliftKg, friendsCount } = params;

  const workoutCount = workouts.length;
  const bestStreak = streakState.bestStreak ?? 0;
  const bestPartnerStreak = streakState.bestPartnerStreak ?? 0;

  const totalMinutes = workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const maxSessionMins = workouts.reduce((m, w) => Math.max(m, w.durationMinutes || 0), 0);

  const hasEarlyBird = workouts.some((w) => {
    const h = new Date(w.timestamp).getHours();
    return h < 7;
  });
  const hasNightOwl = workouts.some((w) => {
    const h = new Date(w.timestamp).getHours();
    return h >= 21;
  });

  const squatLbs = Math.round(convertFromKg(squatKg, 'lbs'));
  const benchLbs = Math.round(convertFromKg(benchKg, 'lbs'));
  const deadliftLbs = Math.round(convertFromKg(deadliftKg, 'lbs'));
  const totalLbs = squatLbs + benchLbs + deadliftLbs;
  const liftsEntered = [squatLbs, benchLbs, deadliftLbs].filter((v) => v > 0).length;

  return [
    // Consistency & Streaks
    {
      id: 'first_rep',
      name: 'First Rep',
      description: 'Log your very first verified gym workout.',
      progressText: `${Math.min(workoutCount, 1)} / 1 workout`,
      unlocked: workoutCount >= 1,
      icon: 'sparkles-outline',
    },
    {
      id: '21_day_habit',
      name: '21 Day Habit',
      description: 'Log 21 gym workouts to forge a lasting routine.',
      progressText: `${Math.min(workoutCount, 21)} / 21 workouts`,
      unlocked: workoutCount >= 21,
      icon: 'flame-outline',
    },
    {
      id: 'century_club',
      name: 'Century Club',
      description: 'Complete 100 total gym workouts.',
      progressText: `${Math.min(workoutCount, 100)} / 100 workouts`,
      unlocked: workoutCount >= 100,
      icon: 'star-outline',
    },
    {
      id: 'unbreakable',
      name: 'Unbreakable',
      description: 'Reach a Personal Streak of 10 workouts.',
      progressText: `${Math.min(bestStreak, 10)} / 10 streak`,
      unlocked: bestStreak >= 10,
      icon: 'flash-outline',
    },
    {
      id: 'perpetual_motion',
      name: 'Perpetual Motion',
      description: 'Reach a Personal Streak of 50 workouts.',
      progressText: `${Math.min(bestStreak, 50)} / 50 streak`,
      unlocked: bestStreak >= 50,
      icon: 'infinite-outline',
    },
    {
      id: 'certified_regular',
      name: 'Certified Regular',
      description: 'Reach a Verified Gym Streak of 10 workouts.',
      progressText: `${Math.min(bestPartnerStreak, 10)} / 10 verified`,
      unlocked: bestPartnerStreak >= 10,
      icon: 'shield-checkmark-outline',
    },

    // Time & Dedication
    {
      id: 'clocking_in',
      name: 'Clocking In',
      description: 'Spend 10 total hours in the gym.',
      progressText: `${Math.min(totalHours, 10)} / 10 hrs`,
      unlocked: totalMinutes >= 10 * 60,
      icon: 'time-outline',
    },
    {
      id: 'iron_resident',
      name: 'Iron Resident',
      description: 'Spend 50 total hours in the gym.',
      progressText: `${Math.min(totalHours, 50)} / 50 hrs`,
      unlocked: totalMinutes >= 50 * 60,
      icon: 'hourglass-outline',
    },
    {
      id: 'rent_due',
      name: 'Rent Due',
      description: 'Spend 100 total hours in the gym—basically live here.',
      progressText: `${Math.min(totalHours, 100)} / 100 hrs`,
      unlocked: totalMinutes >= 100 * 60,
      icon: 'home-outline',
    },
    {
      id: 'expert_10000',
      name: 'Expert',
      description: 'Log 10,000 total hours in the gym. True mastery.',
      progressText: `${Math.min(totalHours, 10000).toLocaleString()} / 10,000 hrs`,
      unlocked: totalMinutes >= 10000 * 60,
      icon: 'diamond-outline',
    },
    {
      id: 'marathoner',
      name: 'Marathoner',
      description: 'Complete a single gym session lasting 90 minutes or longer.',
      progressText: `${Math.min(maxSessionMins, 90)} / 90 mins`,
      unlocked: maxSessionMins >= 90,
      icon: 'stopwatch-outline',
    },
    {
      id: 'early_bird',
      name: 'Early Bird',
      description: 'Start a gym workout before 7:00 AM.',
      progressText: hasEarlyBird ? 'Completed' : 'Before 7:00 AM',
      unlocked: hasEarlyBird,
      icon: 'sunny-outline',
    },
    {
      id: 'night_owl',
      name: 'Night Owl',
      description: 'Start a gym workout at or after 9:00 PM.',
      progressText: hasNightOwl ? 'Completed' : '9:00 PM or later',
      unlocked: hasNightOwl,
      icon: 'moon-outline',
    },

    // Strength & PRs
    {
      id: 'triple_threat',
      name: 'Triple Threat',
      description: 'Log a PR for all three lifts: Squat, Bench, and Deadlift.',
      progressText: `${liftsEntered} / 3 lifts`,
      unlocked: liftsEntered === 3,
      icon: 'fitness-outline',
    },
    {
      id: '225_bench',
      name: 'Two-Plate Press',
      description: 'Reach a Bench Press PR of at least 225 lbs.',
      progressText: `${benchLbs} / 225 lbs`,
      unlocked: benchLbs >= 225,
      icon: 'barbell-outline',
    },
    {
      id: '315_squat',
      name: 'Three-Plate Squat',
      description: 'Reach a Squat PR of at least 315 lbs.',
      progressText: `${squatLbs} / 315 lbs`,
      unlocked: squatLbs >= 315,
      icon: 'barbell-outline',
    },
    {
      id: '405_deadlift',
      name: 'Four-Plate Pull',
      description: 'Reach a Deadlift PR of at least 405 lbs.',
      progressText: `${deadliftLbs} / 405 lbs`,
      unlocked: deadliftLbs >= 405,
      icon: 'barbell-outline',
    },
    {
      id: '1000_club',
      name: '1000 lb Club',
      description: 'Hit a combined Squat + Bench + Deadlift total of 1,000 lbs.',
      progressText: `${totalLbs.toLocaleString()} / 1,000 lbs`,
      unlocked: totalLbs >= 1000,
      icon: 'trophy-outline',
    },
    {
      id: '1500_club',
      name: '1500 lb Club',
      description: 'Hit a combined Squat + Bench + Deadlift total of 1,500 lbs.',
      progressText: `${totalLbs.toLocaleString()} / 1,500 lbs`,
      unlocked: totalLbs >= 1500,
      icon: 'trophy-outline',
    },
    {
      id: '2000_club',
      name: '2000 lb Club',
      description: 'Hit a combined Squat + Bench + Deadlift total of 2,000 lbs.',
      progressText: `${totalLbs.toLocaleString()} / 2,000 lbs`,
      unlocked: totalLbs >= 2000,
      icon: 'medal-outline',
    },

    // Social
    {
      id: 'gym_buddy',
      name: 'Gym Buddy',
      description: 'Make your first mutual friend on Inertia.',
      progressText: `${Math.min(friendsCount, 1)} / 1 friend`,
      unlocked: friendsCount >= 1,
      icon: 'person-add-outline',
    },
    {
      id: 'squad_goals',
      name: 'Squad Goals',
      description: 'Make 5 mutual friends on the Inertia Leaderboard.',
      progressText: `${Math.min(friendsCount, 5)} / 5 friends`,
      unlocked: friendsCount >= 5,
      icon: 'people-circle-outline',
    },
    {
      id: 'social_butterfly',
      name: 'Social Butterfly',
      description: 'Make 10 mutual friends on the Inertia Leaderboard.',
      progressText: `${Math.min(friendsCount, 10)} / 10 friends`,
      unlocked: friendsCount >= 10,
      icon: 'people-outline',
    },
  ];
}
