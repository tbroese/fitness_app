import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { AppTheme } from '../constants/theme';
import { useFitness } from '../context/FitnessContext';

export const MIN_AGE_BOUND = 13;
export const MAX_AGE_BOUND = 80;

interface AgeRangeSliderProps {
  minAge: number;
  maxAge: number;
  onChange: (minAge: number, maxAge: number) => void;
}

export const AgeRangeSlider: React.FC<AgeRangeSliderProps> = ({
  minAge,
  maxAge,
  onChange,
}) => {
  const { theme } = useFitness();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [trackWidth, setTrackWidth] = useState(260);
  const trackWidthRef = useRef(260);
  const minAgeRef = useRef(minAge);
  const maxAgeRef = useRef(maxAge);
  minAgeRef.current = minAge;
  maxAgeRef.current = maxAge;

  const startMinRef = useRef(minAge);
  const startMaxRef = useRef(maxAge);

  const range = MAX_AGE_BOUND - MIN_AGE_BOUND;

  const valueToX = (val: number) =>
    ((val - MIN_AGE_BOUND) / range) * trackWidth;

  const minPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startMinRef.current = minAgeRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const width = Math.max(1, trackWidthRef.current);
        const deltaVal = Math.round((gestureState.dx / width) * range);
        const nextMin = Math.max(
          MIN_AGE_BOUND,
          Math.min(maxAgeRef.current - 1, startMinRef.current + deltaVal)
        );
        if (nextMin !== minAgeRef.current) {
          onChange(nextMin, maxAgeRef.current);
        }
      },
    })
  ).current;

  const maxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startMaxRef.current = maxAgeRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const width = Math.max(1, trackWidthRef.current);
        const deltaVal = Math.round((gestureState.dx / width) * range);
        const nextMax = Math.min(
          MAX_AGE_BOUND,
          Math.max(minAgeRef.current + 1, startMaxRef.current + deltaVal)
        );
        if (nextMax !== maxAgeRef.current) {
          onChange(minAgeRef.current, nextMax);
        }
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      trackWidthRef.current = w;
      setTrackWidth(w);
    }
  };

  const leftX = valueToX(minAge);
  const rightX = valueToX(maxAge);

  const isAllAges = minAge === MIN_AGE_BOUND && maxAge === MAX_AGE_BOUND;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Age Range</Text>
        <Text style={styles.valueText}>
          {isAllAges
            ? 'All Ages'
            : `${minAge} – ${maxAge === MAX_AGE_BOUND ? `${MAX_AGE_BOUND}+` : maxAge} yrs`}
        </Text>
      </View>

      <View style={styles.sliderWrapper}>
        <View style={styles.trackContainer} onLayout={handleLayout}>
          <View style={styles.trackBg} />
          <View
            style={[
              styles.trackFill,
              {
                left: leftX,
                width: Math.max(0, rightX - leftX),
              },
            ]}
          />

          {/* Min Thumb */}
          <View
            {...minPanResponder.panHandlers}
            style={[styles.thumb, { left: leftX - 12 }]}
          >
            <View style={styles.thumbInner} />
          </View>

          {/* Max Thumb */}
          <View
            {...maxPanResponder.panHandlers}
            style={[styles.thumb, { left: rightX - 12 }]}
          >
            <View style={styles.thumbInner} />
          </View>
        </View>
      </View>

      <View style={styles.boundsRow}>
        <Text style={styles.boundText}>{MIN_AGE_BOUND}</Text>
        <Text style={styles.boundText}>{MAX_AGE_BOUND}+</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginTop: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  valueText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.primaryLight,
  },
  sliderWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trackContainer: {
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.cardBackgroundSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  trackFill: {
    position: 'absolute',
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.primary,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  thumbInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  boundsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 2,
  },
  boundText: {
    fontSize: 11,
    color: theme.textTertiary,
    fontWeight: '600',
  },
});
