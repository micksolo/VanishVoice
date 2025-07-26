import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpiryRule } from '../types/database';

interface ExpiryButtonProps {
  onPress: () => void;
  currentRule?: ExpiryRule;
}

export default function ExpiryButton({ onPress, currentRule }: ExpiryButtonProps) {
  const getIcon = () => {
    if (!currentRule || currentRule.type === 'none') {
      return 'timer-outline';
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
        return 'timer-outline';
    }
  };

  const isActive = currentRule && currentRule.type !== 'none';

  return (
    <TouchableOpacity 
      style={[styles.button, isActive && styles.activeButton]} 
      onPress={onPress}
    >
      <Ionicons 
        name={getIcon() as any} 
        size={24} 
        color={isActive ? '#4ECDC4' : '#999'} 
      />
    </TouchableOpacity>
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
    backgroundColor: '#e0f9f7',
  },
});