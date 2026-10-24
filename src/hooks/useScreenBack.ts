import { useCallback, useLayoutEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Android system Back follows the visible screen's existing header action. */
export function useScreenBack(onBack: () => void) {
  const current = useRef(onBack);
  useLayoutEffect(() => { current.current = onBack; }, [onBack]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      current.current();
      return true;
    });
    return () => subscription.remove();
  }, []));
}
