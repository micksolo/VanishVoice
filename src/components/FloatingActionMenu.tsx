import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RandomChatModal from './RandomChatModal';

interface FloatingActionMenuProps {
  onAddFriend: () => void;
  onRandomChat: () => void;
  onNavigateToAnonymousChat?: (conversationId: string, partnerId: string) => void;
}

const { width: initialWidth, height: initialHeight } = Dimensions.get('window');
const DEFAULT_BUTTON_SIZE = 48;
const MAIN_FAB_SIZE = 64; // keep in sync with styles.mainFabButton
const computeGap = (h: number) => Math.max(8, Math.min(16, Math.round(h * 0.012)));

export default function FloatingActionMenu({ onAddFriend, onRandomChat, onNavigateToAnonymousChat }: FloatingActionMenuProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [randomChatModalVisible, setRandomChatModalVisible] = useState(false);
  const [measuredButtonHeight, setMeasuredButtonHeight] = useState<number>(DEFAULT_BUTTON_SIZE);
  const [labelWidths, setLabelWidths] = useState<{ random: number; add: number }>({ random: 0, add: 0 });
  
  // Responsive max width for the label bubble so text doesn't get cut off
  const RIGHT_PADDING = 16; // matches fabContainer.right
  const LABEL_MARGIN_RIGHT = 12; // matches styles.labelContainer.marginRight
  const EXTRA_BUFFER = 24; // breathing room to avoid edge collisions
  const labelMaxWidth = Math.max(
    120,
    Math.min(
      winWidth * 0.9,
      winWidth - (RIGHT_PADDING + LABEL_MARGIN_RIGHT + measuredButtonHeight + EXTRA_BUFFER)
    )
  );
  const randomLabelWidth = Math.min(labelMaxWidth, Math.max(140, labelWidths.random + 24));
  const addLabelWidth = Math.min(labelMaxWidth, Math.max(140, labelWidths.add + 24));

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const addFriendAnim = useRef(new Animated.Value(0)).current;
  const randomChatAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  
  const toggleMenu = () => {
    const duration = 300;
    // Spring animation with specified config
    const springConfig = {
      damping: 15,
      stiffness: 200,
      useNativeDriver: true,
    } as const;

    setIsExpanded((prev) => {
      const next = !prev;
      const toValue = next ? 1 : 0;

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: next ? 1.05 : 1,
          ...springConfig,
        }),
        // Sub-buttons animation with stagger
        Animated.stagger(40, [
          Animated.spring(addFriendAnim, {
            toValue,
            ...springConfig,
          }),
          Animated.spring(randomChatAnim, {
            toValue,
            ...springConfig,
          }),
        ]),
        // Backdrop fade
        Animated.timing(backdropAnim, {
          toValue,
          duration,
          useNativeDriver: true,
        }),
      ]).start();

      return next;
    });
  };
  
  const closeMenu = () => {
    if (!isExpanded) return;
    const duration = 300;
    const springConfig = {
      damping: 15,
      stiffness: 200,
      useNativeDriver: true,
    } as const;

    setIsExpanded(false);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, ...springConfig }),
      Animated.spring(addFriendAnim, { toValue: 0, ...springConfig }),
      Animated.spring(randomChatAnim, { toValue: 0, ...springConfig }),
      Animated.timing(backdropAnim, { toValue: 0, duration, useNativeDriver: true }),
    ]).start();
  };
  
  const handleAction = (action: () => void) => {
    closeMenu();
    // Small delay to let animation finish
    setTimeout(action, 200);
  };

  const handleRandomChatPress = () => {
    closeMenu();
    // Small delay to let animation finish before showing modal
    setTimeout(() => setRandomChatModalVisible(true), 200);
  };

  const handleRandomChatNavigate = (conversationId: string, partnerId: string) => {
    if (onNavigateToAnonymousChat) {
      onNavigateToAnonymousChat(conversationId, partnerId);
    } else {
      // Fallback to original behavior if navigation prop not provided
      onRandomChat();
    }
  };
  
  const getSubButtonTransform = (animValue: Animated.Value, index: number) => {
    const gap = computeGap(winHeight);
    const stepSub = measuredButtonHeight + gap; // distance between sub-buttons
    const baseOffset = MAIN_FAB_SIZE + gap; // distance from main FAB to first sub-button
    const translateY = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -((baseOffset) + (stepSub * index))],
    });
    
    const scale = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });
    
    const opacity = animValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0, 1],
    });
    
    return {
      transform: [{ translateY: translateY as any }, { scale: scale as any }],
      opacity,
    } as const;
  };
  
  const styles = getStyles(theme, insets);
  
  return (
    <>
      {/* Transparent touch catcher (no dimming). Close menu but allow underlying presses. */}
      {isExpanded && (
        <View
          style={styles.touchCatcher}
          pointerEvents="auto"
          onStartShouldSetResponder={() => {
            closeMenu();
            return false; // don't steal the touch; let underlying handle it
          }}
        />
      )}
      
      {/* FAB Container */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        {/* Random Chat Button */}
        <Animated.View
          style={[
            styles.subButtonContainer,
            getSubButtonTransform(randomChatAnim, 1),
            !isExpanded && styles.hidden,
          ]}
          pointerEvents={isExpanded ? 'auto' : 'none'}
        >
          <View style={[
            styles.labelContainer,
            { maxWidth: labelMaxWidth, minWidth: 140, width: randomLabelWidth }
          ]}>
            <Text
              style={styles.label}
              numberOfLines={1}
              ellipsizeMode="tail"
              onLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w > 0 && w !== labelWidths.random) {
                  setLabelWidths((prev) => ({ ...prev, random: w }));
                }
              }}
            >
              Random Chat
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.subButton, styles.randomChatButton]}
            onPress={handleRandomChatPress}
            activeOpacity={0.8}
            onLayout={(e) => setMeasuredButtonHeight(Math.max(DEFAULT_BUTTON_SIZE, Math.round(e.nativeEvent.layout.height)))}
          >
            <Ionicons name="shuffle" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
        
        {/* Add Friend Button */}
        <Animated.View
          style={[
            styles.subButtonContainer,
            getSubButtonTransform(addFriendAnim, 0),
            !isExpanded && styles.hidden,
          ]}
          pointerEvents={isExpanded ? 'auto' : 'none'}
        >
          <View style={[
            styles.labelContainer,
            { maxWidth: labelMaxWidth, minWidth: 140, width: addLabelWidth }
          ]}>
            <Text
              style={styles.label}
              numberOfLines={1}
              ellipsizeMode="tail"
              onLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w > 0 && w !== labelWidths.add) {
                  setLabelWidths((prev) => ({ ...prev, add: w }));
                }
              }}
            >
              Add Friend
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.subButton, styles.addFriendButton]}
            onPress={() => handleAction(onAddFriend)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
        
        {/* Main FAB */}
        <Animated.View
          style={[
            styles.mainFab,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <TouchableOpacity
            style={styles.mainFabButton}
            onPress={toggleMenu}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'Close actions' : 'Open actions'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons 
              name={isExpanded ? "close" : "add"}
              size={28} 
              color="#fff"
            />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Random Chat Modal */}
      <RandomChatModal
        visible={randomChatModalVisible}
        onClose={() => setRandomChatModalVisible(false)}
        onNavigateToChat={handleRandomChatNavigate}
      />
    </>
  );
}

const getStyles = (theme: Theme, insets: any) => StyleSheet.create({
  touchCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 998,
  },
  fabContainer: {
    position: 'absolute',
    bottom: insets.bottom + 24, // Sit just above the tab bar
    right: 16,
    alignItems: 'flex-end', // Right-justify children
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  mainFab: {
    shadowColor: '#B026FF',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  mainFabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#B026FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#B026FF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  subButtonContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
    elevation: 14,
  },
  labelContainer: {
    marginRight: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexShrink: 1,
    zIndex: 2,
    elevation: 16,
    justifyContent: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  subButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addFriendButton: {
    backgroundColor: '#FF1B8D',
  },
  randomChatButton: {
    backgroundColor: '#00D9FF',
  },
  hidden: {
    display: 'none',
  },
});
