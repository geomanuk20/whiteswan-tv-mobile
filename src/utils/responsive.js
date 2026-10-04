import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base standard guideline sizes (based on standard iPhone 11/13/14 screen - 390 x 844)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/**
 * Horizontal scale based on screen width
 */
export const scale = (size) => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Vertical scale based on screen height
 */
export const verticalScale = (size) => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

/**
 * Moderate scale with configurable resize factor (default 0.5)
 * Great for font sizes, margins and paddings so they don't grow or shrink excessively
 */
export const moderateScale = (size, factor = 0.5) => {
  return size + (scale(size) - size) * factor;
};

/**
 * Responsive font scale with safety clamps
 */
export const fontScale = (size) => {
  const newSize = moderateScale(size, 0.4);
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
};

/**
 * Screen type checks
 */
export const isSmallScreen = SCREEN_WIDTH < 375;
export const isLargeScreen = SCREEN_WIDTH >= 430;
export const isTablet = SCREEN_WIDTH >= 768;

/**
 * 16:9 Aspect Ratio Height Calculator
 */
export const get16x9Height = (width = SCREEN_WIDTH) => {
  return Math.round((width * 9) / 16);
};
