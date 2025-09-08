import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpiryRule } from '../types/database';
import { EphemeralMessageService } from '../services/ephemeralMessages';
import { useAppTheme } from '../contexts/ThemeContext';

interface EphemeralIndicatorProps {
  expiryRule: ExpiryRule;
  createdAt: Date;
  isMine: boolean;
  hasBeenViewed?: boolean;
}

export default function EphemeralIndicator({ 
  expiryRule, 
  createdAt, 
  isMine,
  hasBeenViewed = false 
}: EphemeralIndicatorProps) {
  const theme = useAppTheme();

  if (expiryRule.type === 'none') {
    return null; // No indicator for non-ephemeral messages
  }

  const getIcon = () => {
    switch (expiryRule.type) {
      case 'view':
        return hasBeenViewed ? 'radio-button-off' : 'radio-button-on';
      case 'read':
        return hasBeenViewed ? 'mail-open' : 'mail';
      case 'playback':
        return hasBeenViewed ? 'play-circle' : 'play-circle-outline';
      case 'session':
        return hasBeenViewed ? 'exit-outline' : 'chatbubble-outline';
      default:
        return 'eye';
    }
  };

  const getColor = () => {
    if (hasBeenViewed && EphemeralMessageService.disappearsAfterViewing(expiryRule)) {
      return theme.colors.status.error + 'CC'; // Semi-transparent error color
    }
    
    return isMine 
      ? theme.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
      : theme.colors.text.accent + '33'; // 20% opacity
  };

  const getText = () => {
    if (hasBeenViewed && EphemeralMessageService.disappearsAfterViewing(expiryRule)) {
      return 'Viewed';
    }
    
    switch (expiryRule.type) {
      case 'view':
        return 'View once';
      case 'read':
        return 'Read once';
      case 'playback':
        return 'Play once';
      case 'session':
        return hasBeenViewed ? 'Clears on exit' : 'In chat only';
      default:
        return 'Ephemeral';
    }
  };

  const getTextColor = () => {
    if (hasBeenViewed && EphemeralMessageService.disappearsAfterViewing(expiryRule)) {
      return theme.colors.text.inverse;
    }
    
    return isMine 
      ? theme.isDark ? theme.colors.text.primary : theme.colors.text.secondary
      : theme.colors.text.primary;
  };

  return (
    <View style={[styles.container, { backgroundColor: getColor() }]}>
      {expiryRule.type === 'view' && !hasBeenViewed ? (
        <View style={styles.viewOnceIconContainer}>
          <Ionicons 
            name="radio-button-on" 
            size={12} 
            color={getTextColor()} 
          />
          <Text style={[styles.viewOnceNumber, { color: getTextColor() }]}>1</Text>
        </View>
      ) : (
        <Ionicons 
          name={getIcon()} 
          size={12} 
          color={getTextColor()} 
          style={styles.icon}
        />
      )}
      <Text style={[
        styles.text, 
        theme.typography.labelSmall,
        { color: getTextColor() }
      ]}>
        {getText()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
  },
  viewOnceIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 12,
    height: 12,
    marginRight: 4,
  },
  viewOnceNumber: {
    position: 'absolute',
    fontSize: 6,
    fontWeight: 'bold',
    textAlign: 'center',
    top: 1,
    left: 0,
    right: 0,
  },
});