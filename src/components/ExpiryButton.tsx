import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpiryRule } from '../types/database';

interface ExpiryButtonProps {
  onPress: () => void;
  onLongPress?: () => void;
  currentRule?: ExpiryRule;
  mode?: 'full' | 'toggle'; // 'full' opens selector, 'toggle' switches between view-once and none
}

export default function ExpiryButton({ onPress, onLongPress, currentRule, mode = 'full' }: ExpiryButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  
  const getIcon = () => {
    if (!currentRule || currentRule.type === 'none') {
      return 'eye-off-outline';
    }
    
    switch (currentRule.type) {
      case 'view':
        return 'eye';
      case 'read':
        return 'mail';
      case 'playback':
        return 'play-circle';
      case 'time':
        return 'timer';
      case 'location':
        return 'location';
      case 'event':
        return 'calendar';
      default:
        return 'eye-off-outline';
    }
  };

  const isActive = currentRule && currentRule.type !== 'none';

  // Animate when active state changes
  useEffect(() => {
    if (isActive) {
      Animated.spring(scaleAnim, {
        toValue: 1.1,
        friction: 3,
        useNativeDriver: true,
      }).start(() => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isActive]);

  const handlePress = () => {
    // Animate on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
    
    onPress();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
      }}
    >
      <TouchableOpacity 
        style={[styles.button, isActive && styles.activeButton]} 
        onPress={handlePress}
        onLongPress={onLongPress}
      >
        <Ionicons 
          name={getIcon() as any} 
          size={24} 
          color={isActive ? '#fff' : '#999'} 
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  activeButton: {
    backgroundColor: '#4ECDC4',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});