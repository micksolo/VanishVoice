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
  ({ children, type = 'dissolve', duration = 800, onComplete }, ref) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    // Particle animation values
    const particles = Array(8).fill(null).map(() => ({
      x: useRef(new Animated.Value(0)).current,
      y: useRef(new Animated.Value(0)).current,
      opacity: useRef(new Animated.Value(0)).current,
      scale: useRef(new Animated.Value(0.5)).current,
    }));

    const vanish = () => {
      switch (type) {
        case 'fade':
          // Simple fade out
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }).start(onComplete);
          break;

        case 'dissolve':
          // Fade with scale and slight rotation for organic feel
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 0.8,
              friction: 7,
              tension: 40,
              useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration,
              useNativeDriver: true,
            }),
          ]).start(onComplete);
          break;

        case 'shrink':
          // Shrink to center with fade
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: duration * 0.7,
              delay: duration * 0.3,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 0,
              friction: 5,
              tension: 50,
              useNativeDriver: true,
            }),
          ]).start(onComplete);
          break;

        case 'particles':
          // Explode into particles
          // First, show particles
          particles.forEach((particle, i) => {
            const angle = (i / particles.length) * Math.PI * 2;
            const distance = 60 + Math.random() * 40;

            Animated.sequence([
              // Show particle
              Animated.timing(particle.opacity, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
              }),
              // Move and fade particle
              Animated.parallel([
                Animated.timing(particle.x, {
                  toValue: Math.cos(angle) * distance,
                  duration: duration - 100,
                  useNativeDriver: true,
                }),
                Animated.timing(particle.y, {
                  toValue: Math.sin(angle) * distance,
                  duration: duration - 100,
                  useNativeDriver: true,
                }),
                Animated.timing(particle.opacity, {
                  toValue: 0,
                  duration: duration - 100,
                  useNativeDriver: true,
                }),
                Animated.timing(particle.scale, {
                  toValue: 0,
                  duration: duration - 100,
                  useNativeDriver: true,
                }),
              ]),
            ]).start();
          });

          // Fade main content
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: duration * 0.5,
            useNativeDriver: true,
          }).start(onComplete);
          break;
      }
    };

    useImperativeHandle(ref, () => ({
      vanish,
    }));

    const getTransform = () => {
      const transforms: any[] = [{ scale: scaleAnim }];

      if (type === 'dissolve') {
        transforms.push({
          rotate: rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '5deg'],
          }),
        });
      }

      return transforms;
    };

    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: getTransform(),
            },
          ]}
        >
          {children}
        </Animated.View>

        {/* Particle layers */}
        {type === 'particles' && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {particles.map((particle, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.particle,
                  {
                    opacity: particle.opacity,
                    transform: [
                      { translateX: particle.x },
                      { translateY: particle.y },
                      { scale: particle.scale },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        )}
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
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B5CF6',
    top: '50%',
    left: '50%',
    marginTop: -3,
    marginLeft: -3,
  },
});

export default VanishAnimation;