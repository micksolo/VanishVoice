import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

export type VanishType = 'fade' | 'dissolve' | 'particles' | 'shrink';

interface VanishAnimationProps {
  children: React.ReactNode;
  type?: VanishType;
  duration?: number;
  onComplete?: () => void;
}

export interface VanishAnimationRef {
  vanish: () => void;
}

const VanishAnimation = forwardRef<VanishAnimationRef, VanishAnimationProps>(
  ({ children, type = 'fade', duration = 300, onComplete }, ref) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const vanish = () => {
      // Simple fade out for all types
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }).start(onComplete);
    };

    useImperativeHandle(ref, () => ({
      vanish,
    }));


    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  content: {
    // Content styling handled by children
  },
});

export default VanishAnimation;