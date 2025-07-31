import React, { useState, useEffect } from 'react';
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
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Update countdown for time-based expiry
  useEffect(() => {
    if (expiryRule.type === 'time') {
      const updateCountdown = () => {
        const now = new Date();
        const expiryTime = new Date(createdAt.getTime() + (expiryRule.duration_sec * 1000));
        const remaining = Math.max(0, expiryTime.getTime() - now.getTime());
        setTimeRemaining(remaining);
      };
      
      // Update immediately
      updateCountdown();
      
      // Update every second
      const interval = setInterval(updateCountdown, 1000);
      
      return () => clearInterval(interval);
    }
  }, [expiryRule, createdAt]);

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
      case 'time':
        return 'timer';
      case 'location':
        return 'location';
      case 'event':
        return 'calendar';
      default:
        return 'time';
    }
  };

  const getColor = () => {
    if (hasBeenViewed && EphemeralMessageService.disappearsAfterViewing(expiryRule)) {
      return theme.colors.status.error + 'CC'; // Semi-transparent error color
    }
    
    if (expiryRule.type === 'time' && timeRemaining !== null) {
      if (timeRemaining < 60000) { // Less than 1 minute
        return theme.colors.status.error + 'CC';
      } else if (timeRemaining < 300000) { // Less than 5 minutes
        return theme.colors.status.warning + 'CC';
      }
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
      case 'time':
        if (timeRemaining !== null) {
          const seconds = Math.floor(timeRemaining / 1000);
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const remainingSeconds = seconds % 60;
          
          if (hours > 0) {
            return `${hours}h ${minutes}m`;
          } else if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
          } else {
            return `${remainingSeconds}s`;
          }
        }
        return 'Expires soon';
      case 'location':
        return 'Location';
      case 'event':
        return 'Event';
      default:
        return 'Ephemeral';
    }
  };

  const getTextColor = () => {
    if (hasBeenViewed && EphemeralMessageService.disappearsAfterViewing(expiryRule)) {
      return theme.colors.text.inverse;
    }
    
    if (expiryRule.type === 'time' && timeRemaining !== null) {
      if (timeRemaining < 60000 || timeRemaining < 300000) {
        return theme.colors.text.inverse;
      }
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