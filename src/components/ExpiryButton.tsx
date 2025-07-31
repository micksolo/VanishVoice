import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Animated, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpiryRule } from '../types/database';

interface ExpiryButtonProps {
  onPress: () => void;
  currentRule?: ExpiryRule;
}

export default function ExpiryButton({ onPress, currentRule }: ExpiryButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  
  const getTimeLabel = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };
  
  const getIcon = () => {
    if (!currentRule || currentRule.type === 'none') {
      return 'infinite';
    }
    
    switch (currentRule.type) {
      case 'view':
        return 'eye'; // View once icon
      case 'read':
        return 'eye'; // Consolidated with view
      case 'playback':
        return 'eye'; // Consolidated with view
      case 'time':
        return 'timer';
      case 'location':
        return 'location';
      case 'event':
        return 'calendar';
      default:
        return 'infinite';
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
      >
        {(currentRule?.type === 'view' || currentRule?.type === 'read' || currentRule?.type === 'playback') && isActive ? (
          <View style={styles.viewOnceIconContainer}>
            <Ionicons 
              name="eye" 
              size={24} 
              color="#fff" 
            />
            <View style={styles.viewOnceBadge}>
              <Text style={styles.viewOnceNumber}>1</Text>
            </View>
          </View>
        ) : currentRule?.type === 'time' && isActive ? (
          <View style={styles.viewOnceIconContainer}>
            <Ionicons 
              name="timer" 
              size={24} 
              color="#fff" 
            />
            {currentRule.duration_sec && (
              <View style={styles.timeBadge}>
                <Text style={styles.timeText}>
                  {getTimeLabel(currentRule.duration_sec)}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Ionicons 
            name={getIcon() as any} 
            size={24} 
            color={isActive ? '#fff' : '#999'} 
          />
        )}
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
  viewOnceIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  viewOnceNumber: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 12,
  },
  viewOnceBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF4444',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
  },
  timeBadge: {
    position: 'absolute',
    bottom: -6,
    right: -8,
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
});