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

  // Update selected rule when currentRule prop changes or when modal opens
  useEffect(() => {
    if (currentRule) {
      console.log('[ExpiryRuleSelector] Updating selectedRule from currentRule:', currentRule);
      setSelectedRule(currentRule);
    }
  }, [currentRule, visible]); // Added 'visible' to dependencies to update when modal opens

  const handleSelect = () => {
    onSelect(selectedRule);
    onClose();
  };

  const expiryOptions = [
    {
      rule: { type: 'none' } as ExpiryRule,
      icon: 'infinite',
      title: 'Keep Permanently',
      description: 'Message stays until manually cleared',
      isPremium: false
    },
    {
      rule: { type: 'view' } as ExpiryRule,
      icon: 'eye',
      title: 'View Once',
      description: messageType === 'text' 
        ? 'Disappears after reading' 
        : messageType === 'voice' || messageType === 'video'
        ? 'Disappears after playing'
        : 'Disappears after viewing',
      isPremium: false
    }
  ];

  const premiumFeatures = [
    {
      icon: 'trash',
      title: 'Clear All Messages',
      description: 'Clear messages on both your device and recipient\'s device',
      isPremium: true,
      feature: 'clear_both_devices'
    },
    {
      icon: 'shield-checkmark',
      title: 'Screenshot Blocking',
      description: 'Prevent screenshots of your messages',
      isPremium: true,
      feature: 'screenshot_protection'
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
              <Text style={[styles.title, { color: theme.colors.text.primary }]}>Message Privacy</Text>
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
              
              {/* Premium Features Section */}
              <View style={[styles.premiumSection, { borderTopColor: theme.colors.border.default }]}>
                <Text style={[styles.premiumSectionTitle, { color: theme.colors.text.accent }]}>
                  Premium Features
                </Text>
                {premiumFeatures.map((feature, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.option, 
                      { borderBottomColor: theme.colors.border.default },
                      { opacity: 0.7 } // Disabled appearance
                    ]}
                    onPress={() => {
                      // TODO: Show premium upgrade modal
                      console.log('Premium feature tapped:', feature.feature);
                    }}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[
                        styles.iconContainer, 
                        { backgroundColor: theme.colors.text.accent + '20' }
                      ]}>
                        <Ionicons 
                          name={feature.icon as any} 
                          size={24} 
                          color={theme.colors.text.accent} 
                        />
                      </View>
                      <View style={styles.optionText}>
                        <View style={styles.premiumTitleRow}>
                          <Text style={[
                            styles.optionTitle, 
                            { color: theme.colors.text.primary }
                          ]}>
                            {feature.title}
                          </Text>
                          <View style={[styles.premiumBadge, { backgroundColor: theme.colors.text.accent }]}>
                            <Text style={[styles.premiumBadgeText, { color: theme.colors.text.inverse }]}>
                              PRO
                            </Text>
                          </View>
                        </View>
                        <Text style={[
                          styles.optionDescription, 
                          { color: theme.colors.text.secondary }
                        ]}>
                          {feature.description}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="diamond" size={20} color={theme.colors.text.accent} />
                  </TouchableOpacity>
                ))}
              </View>
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
  premiumSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  premiumSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  premiumTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});