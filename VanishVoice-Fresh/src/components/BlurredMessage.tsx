import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';

interface BlurredMessageProps {
  content: string;
  onReveal?: () => void;
  messageType?: 'text' | 'voice' | 'video' | 'image';
}

export default function BlurredMessage({
  content,
  onReveal,
  messageType = 'text',
}: BlurredMessageProps) {
  const theme = useAppTheme();
  const [isRevealed, setIsRevealed] = useState(false);

  const handleReveal = () => {
    if (isRevealed) return;
    setIsRevealed(true);
    onReveal?.();
  };

  const getIcon = () => {
    switch (messageType) {
      case 'voice':
        return 'mic';
      case 'video':
        return 'videocam';
      case 'image':
        return 'image';
      default:
        return 'eye-off';
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleReveal}
      disabled={isRevealed}
      style={styles.container}
    >
      {!isRevealed ? (
        <View style={[styles.hiddenContainer, { backgroundColor: theme.colors.text.secondary + '20' }]}>
          <Ionicons
            name={getIcon()}
            size={20}
            color={theme.colors.text.secondary}
          />
          <Text style={[styles.tapText, { color: theme.colors.text.secondary }]}>
            {messageType === 'voice' ? 'Voice' :
             messageType === 'video' ? 'Video' :
             messageType === 'image' ? 'Image' :
             'Tap to view'}
          </Text>
        </View>
      ) : (
        <Text style={[styles.revealedText, { color: theme.colors.text.primary }]}>
          {content}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 40,
    justifyContent: 'center',
  },
  hiddenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    minHeight: 40,
    borderRadius: 8,
    gap: 6,
  },
  tapText: {
    fontSize: 13,
    fontWeight: '500',
  },
  revealedText: {
    fontSize: 14,
    lineHeight: 20,
    padding: 2,
  },
});