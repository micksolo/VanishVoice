import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  SafeAreaView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpiryRule } from '../types/database';
import { EphemeralMessageService } from '../services/ephemeralMessages';
import { useAppTheme } from '../contexts/ThemeContext';

interface ExpiryRuleSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (rule: ExpiryRule) => void;
  messageType: 'text' | 'voice' | 'video';
  currentRule?: ExpiryRule;
}

export default function ExpiryRuleSelector({ 
  visible, 
  onClose, 
  onSelect,
  messageType = 'text',
  currentRule 
}: ExpiryRuleSelectorProps) {
  const theme = useAppTheme();
  const [selectedRule, setSelectedRule] = useState<ExpiryRule>(currentRule || { type: 'none' });
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  
  console.log('[ExpiryRuleSelector] Component rendered with props:', {
    visible,
    messageType,
    currentRule
  });

  // Update selected rule when currentRule prop changes
  useEffect(() => {
    if (currentRule) {
      setSelectedRule(currentRule);
    }
  }, [currentRule]);

  const handleSelect = () => {
    onSelect(selectedRule);
    onClose();
  };

  const expiryOptions = [
    {
      rule: { type: 'none' } as ExpiryRule,
      icon: 'infinite',
      title: 'No Expiry',
      description: 'Message never expires'
    },
    {
      rule: { type: 'view' } as ExpiryRule,
      icon: 'eye',
      title: 'View Once',
      description: messageType === 'text' 
        ? 'Disappears after reading' 
        : messageType === 'voice' || messageType === 'video'
        ? 'Disappears after playing'
        : 'Disappears after viewing'
    },
    {
      rule: { type: 'time', duration_sec: 60 } as ExpiryRule,
      icon: 'timer',
      title: '1 Minute',
      description: 'Expires in 1 minute'
    },
    {
      rule: { type: 'time', duration_sec: 300 } as ExpiryRule,
      icon: 'timer',
      title: '5 Minutes',
      description: 'Expires in 5 minutes'
    },
    {
      rule: { type: 'time', duration_sec: 3600 } as ExpiryRule,
      icon: 'timer',
      title: '1 Hour',
      description: 'Expires in 1 hour'
    },
    {
      rule: { type: 'time', duration_sec: 86400 } as ExpiryRule,
      icon: 'timer',
      title: '24 Hours',
      description: 'Expires in 24 hours'
    },
    {
      rule: { type: 'time', duration_sec: 604800 } as ExpiryRule,
      icon: 'timer',
      title: '7 Days',
      description: 'Expires in 7 days'
    }
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        
        <View style={[styles.content, { 
          backgroundColor: theme.isDark ? '#1A1A24' : theme.colors.background.primary 
        }]}>
          {Platform.OS === 'ios' ? (
            <SafeAreaView style={styles.safeArea}>
              {renderContent()}
            </SafeAreaView>
          ) : (
            <View style={styles.safeArea}>
              {renderContent()}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  function renderContent() {
    return (
      <>
            <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
              <Text style={[styles.title, { color: theme.colors.text.primary }]}>Message Expiry</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.optionsList}
              onScroll={({ nativeEvent }) => {
                const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
                const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 10;
                setShowScrollIndicator(!isAtBottom && contentSize.height > layoutMeasurement.height);
              }}
              onContentSizeChange={(contentWidth, contentHeight) => {
                // Check if content is scrollable on mount
                const scrollView = styles.optionsList;
                if (contentHeight > 400) { // Approximate visible height
                  setShowScrollIndicator(true);
                }
              }}
              scrollEventThrottle={16}
            >
              {expiryOptions.map((option, index) => {
                const isSelected = JSON.stringify(selectedRule) === JSON.stringify(option.rule);
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.option, 
                      { borderBottomColor: theme.colors.border.default },
                      isSelected && { backgroundColor: theme.colors.background.secondary }
                    ]}
                    onPress={() => setSelectedRule(option.rule)}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[
                        styles.iconContainer, 
                        { backgroundColor: theme.colors.background.secondary },
                        isSelected && { backgroundColor: theme.colors.text.accent }
                      ]}>
                        <Ionicons 
                          name={option.icon as any} 
                          size={24} 
                          color={isSelected ? '#FFFFFF' : theme.colors.text.accent} 
                        />
                      </View>
                      <View style={styles.optionText}>
                        <Text style={[
                          styles.optionTitle, 
                          { color: theme.colors.text.primary },
                          isSelected && { color: theme.colors.text.accent }
                        ]}>
                          {option.title}
                        </Text>
                        <Text style={[
                          styles.optionDescription, 
                          { color: theme.colors.text.secondary },
                          isSelected && { color: theme.colors.text.accent }
                        ]}>
                          {option.description}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={theme.colors.text.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {showScrollIndicator && (
              <View style={[styles.scrollIndicator, { backgroundColor: theme.colors.background.primary }]}>
                <Ionicons name="chevron-down" size={20} color={theme.colors.text.secondary} />
              </View>
            )}

            <View style={[styles.footer, { borderTopColor: theme.colors.border.default }]}>
              <TouchableOpacity 
                style={[styles.selectButton, { backgroundColor: theme.colors.text.accent }]} 
                onPress={handleSelect}
              >
                <Text style={[styles.selectButtonText, { color: theme.colors.text.inverse }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
      </>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  selectedOption: {
    // Now handled inline with theme
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  selectedIconContainer: {
    // Now handled inline with theme
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectedText: {
    // Now handled inline with theme
  },
  optionDescription: {
    fontSize: 14,
  },
  selectedDescription: {
    // Now handled inline with theme
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  selectButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scrollIndicator: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});