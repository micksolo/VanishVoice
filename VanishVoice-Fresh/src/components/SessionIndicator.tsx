import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';

interface SessionIndicatorProps {
  isActive: boolean;
  messageCount: number;
  lastActivity?: Date;
  onClearSession?: () => void;
  showClearButton?: boolean;
  style?: any;
}

export default function SessionIndicator({
  isActive,
  messageCount,
  lastActivity,
  onClearSession,
  showClearButton = true,
  style,
}: SessionIndicatorProps) {
  const theme = useAppTheme();

  const formatLastActivity = (date?: Date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getStatusColor = () => {
    if (!isActive) return theme.colors.text.disabled;
    return messageCount > 0 ? theme.colors.status.success : theme.colors.text.secondary;
  };

  const getStatusIcon = () => {
    if (!isActive) return 'pause-circle-outline';
    return messageCount > 0 ? 'chatbubbles' : 'chatbubble-outline';
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.statusRow}>
        <View style={styles.statusInfo}>
          <Ionicons
            name={getStatusIcon()}
            size={16}
            color={getStatusColor()}
            style={styles.statusIcon}
          />
          <Text
            style={[
              styles.statusText,
              theme.typography.labelMedium,
              { color: getStatusColor() },
            ]}
          >
            {isActive ? 'Active session' : 'Inactive session'}
          </Text>
        </View>

        {showClearButton && onClearSession && (
          <TouchableOpacity
            style={[
              styles.clearButton,
              {
                backgroundColor: theme.colors.button.secondary.background,
                borderColor: theme.colors.border.subtle,
              },
            ]}
            onPress={onClearSession}
          >
            <Ionicons
              name="trash-outline"
              size={14}
              color={theme.colors.button.secondary.text}
            />
            <Text
              style={[
                styles.clearButtonText,
                theme.typography.labelSmall,
                { color: theme.colors.button.secondary.text },
              ]}
            >
              Clear
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.detailsRow}>
        <Text
          style={[
            styles.detailText,
            theme.typography.labelSmall,
            { color: theme.colors.text.tertiary },
          ]}
        >
          {messageCount} message{messageCount !== 1 ? 's' : ''}
        </Text>
        <Text
          style={[
            styles.detailText,
            theme.typography.labelSmall,
            { color: theme.colors.text.tertiary },
          ]}
        >
          {formatLastActivity(lastActivity)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    marginRight: 6,
  },
  statusText: {
    fontWeight: '500',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  clearButtonText: {
    marginLeft: 4,
    fontWeight: '500',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailText: {
    opacity: 0.7,
  },
});