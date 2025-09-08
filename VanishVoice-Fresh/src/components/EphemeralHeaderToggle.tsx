import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  Text,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExpiryRule } from '../types/database';
import { useAppTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ExpiryButton from './ExpiryButton';

interface EphemeralHeaderToggleProps {
  currentRule: ExpiryRule;
  onPress: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function EphemeralHeaderToggle({
  currentRule,
  onPress,
}: EphemeralHeaderToggleProps) {
  const theme = useAppTheme();
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasSeenTooltip, setHasSeenTooltip] = useState(true);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const isActive = currentRule && currentRule.type !== 'none';

  // Check if user has seen the tooltip before
  useEffect(() => {
    checkTooltipStatus();
  }, []);

  // Animate pulse effect when active
  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation(() => {
        pulseAnim.setValue(1);
      });
    }
  }, [isActive]);

  const checkTooltipStatus = async () => {
    try {
      const hasSeenTooltipValue = await AsyncStorage.getItem('has_seen_ephemeral_header_tooltip');
      if (!hasSeenTooltipValue) {
        setHasSeenTooltip(false);
        // Show tooltip after a brief delay
        setTimeout(() => {
          setShowTooltip(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Error checking tooltip status:', error);
    }
  };

  const markTooltipAsSeen = async () => {
    try {
      await AsyncStorage.setItem('has_seen_ephemeral_header_tooltip', 'true');
      setHasSeenTooltip(true);
      setShowTooltip(false);
    } catch (error) {
      console.error('Error marking tooltip as seen:', error);
    }
  };

  const handlePress = () => {
    // Animate press effect
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

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    onPress();

    // Hide tooltip if showing
    if (showTooltip) {
      markTooltipAsSeen();
    }
  };


  return (
    <>
      <View style={styles.headerButtonContainer}>
        <ExpiryButton
          onPress={handlePress}
          currentRule={currentRule}
        />
      </View>

      {/* Tooltip Modal */}
      <Modal
        visible={showTooltip && !hasSeenTooltip}
        transparent={true}
        animationType="fade"
        onRequestClose={markTooltipAsSeen}
      >
        <View style={styles.tooltipOverlay}>
          <Pressable style={styles.tooltipBackdrop} onPress={markTooltipAsSeen}>
            <View style={[styles.tooltipContainer, { backgroundColor: theme.colors.background.primary }]}>
              <View style={[styles.tooltipArrow, { borderBottomColor: theme.colors.background.primary }]} />
              <Text style={[styles.tooltipTitle, { color: theme.colors.text.primary }]}>⏱️ Disappearing Messages</Text>
              <Text style={[styles.tooltipText, { color: theme.colors.text.secondary }]}>
                Tap the timer icon to set disappearing messages.
                Choose from various expiry options.
              </Text>
              <TouchableOpacity
                style={styles.tooltipButton}
                onPress={markTooltipAsSeen}
              >
                <Text style={styles.tooltipButtonText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerButtonContainer: {
    marginLeft: 4,
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  tooltipBackdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 100, // Position below the header
  },
  tooltipContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipArrow: {
    position: 'absolute',
    top: -8,
    right: 60, // Position to point to the header icon
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'white',
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  tooltipText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  tooltipButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  tooltipButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});