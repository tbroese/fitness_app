import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, PanResponder, View } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFitness } from '../../context/FitnessContext';

const TAB_ROUTES = ['/', '/history', '/leaderboard', '/goal', '/profile'] as const;

export default function TabLayout() {
  const { theme } = useFitness();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const currentIndexRef = useRef(0);
  const slideX = useRef(new Animated.Value(0)).current;
  const pendingEnterDirectionRef = useRef<'left' | 'right' | null>(null);
  const isAnimatingRef = useRef(false);

  const normalized = pathname === '/index' ? '/' : pathname;
  const detectedIndex = TAB_ROUTES.indexOf(normalized as (typeof TAB_ROUTES)[number]);
  currentIndexRef.current = detectedIndex === -1 ? 0 : detectedIndex;

  // Slide the new page in ONLY after Expo Router has actually switched to the new pathname
  useEffect(() => {
    const dir = pendingEnterDirectionRef.current;
    if (!dir) return;

    pendingEnterDirectionRef.current = null;
    const screenWidth = Dimensions.get('window').width;
    const enterFrom = dir === 'left' ? screenWidth * 0.35 : -screenWidth * 0.35;
    slideX.setValue(enterFrom);

    Animated.spring(slideX, {
      toValue: 0,
      tension: 95,
      friction: 14,
      useNativeDriver: true,
    }).start(() => {
      isAnimatingRef.current = false;
    });
  }, [pathname, slideX]);

  const animateTabSwitch = (targetRoute: (typeof TAB_ROUTES)[number], direction: 'left' | 'right') => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    const screenWidth = Dimensions.get('window').width;
    const exitTo = direction === 'left' ? -screenWidth : screenWidth;

    Animated.timing(slideX, {
      toValue: exitTo,
      duration: 130,
      useNativeDriver: true,
    }).start(() => {
      pendingEnterDirectionRef.current = direction;
      router.navigate(targetRoute);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isAnimatingRef.current) return false;
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);
        return absDx > 25 && absDx > absDy * 1.6;
      },
      onPanResponderMove: (_, gestureState) => {
        slideX.setValue(gestureState.dx * 0.65);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const idx = currentIndexRef.current;

        // Swipe left -> move current page left, bring in next tab (wrap far right -> far left)
        if (dx <= -55 || vx <= -0.45) {
          const nextIdx = (idx + 1) % TAB_ROUTES.length;
          animateTabSwitch(TAB_ROUTES[nextIdx], 'left');
          return;
        }

        // Swipe right -> move current page right, bring in previous tab (wrap far left -> far right)
        if (dx >= 55 || vx >= 0.45) {
          const prevIdx = (idx - 1 + TAB_ROUTES.length) % TAB_ROUTES.length;
          animateTabSwitch(TAB_ROUTES[prevIdx], 'right');
          return;
        }

        Animated.spring(slideX, {
          toValue: 0,
          tension: 100,
          friction: 12,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }} {...panResponder.panHandlers}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: slideX }] }}>
        <Tabs
          key={theme.background}
          screenOptions={{
            animation: 'none',
            lazy: false,
            sceneStyle: { backgroundColor: theme.background },
            tabBarPosition: 'top',
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderBottomColor: theme.tabBarBorder,
          borderBottomWidth: 1,
          paddingTop: Math.max(insets.top, 12),
          height: 56 + Math.max(insets.top, 12),
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 6,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Streak',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'flame' : 'flame-outline'}
              size={size || 20}
              color={typeof color === 'string' ? color : theme.primary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={size || 20}
              color={typeof color === 'string' ? color : theme.primary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'trophy' : 'trophy-outline'}
              size={size || 20}
              color={typeof color === 'string' ? color : theme.primary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goal"
        options={{
          title: 'Goal & Gym',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'options' : 'options-outline'}
              size={size || 20}
              color={typeof color === 'string' ? color : theme.primary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size || 20}
              color={typeof color === 'string' ? color : theme.primary}
            />
          ),
        }}
      />
        </Tabs>
      </Animated.View>
    </View>
  );
}
