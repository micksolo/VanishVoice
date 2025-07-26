import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpiryRule } from '../types/database';
import { EphemeralMessageService } from '../services/ephemeralMessages';

interface ExpiryRuleSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (rule: ExpiryRule) => void;
  messageType: 'text' | 'voice' | 'video';
}

export default function ExpiryRuleSelector({ 
  visible, 
  onClose, 
  onSelect,
  messageType 
}: ExpiryRuleSelectorProps) {
  const [selectedRule, setSelectedRule] = useState<ExpiryRule>({ type: 'none' });

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
    ...(messageType === 'text' ? [{
      rule: { type: 'read' } as ExpiryRule,
      icon: 'mail',
      title: 'Read Once',
      description: 'Disappears after reading'
    }] : []),
    ...(messageType === 'voice' || messageType === 'video' ? [{
      rule: { type: 'playback' } as ExpiryRule,
      icon: 'play-circle',
      title: 'Play Once',
      description: 'Disappears after playing'
    }] : []),
    {
      rule: { type: 'view' } as ExpiryRule,
      icon: 'eye',
      title: 'View Once',
      description: 'Disappears after viewing'
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
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        
        <View style={styles.content}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Text style={styles.title}>Message Expiry</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.optionsList}>
              {expiryOptions.map((option, index) => {
                const isSelected = JSON.stringify(selectedRule) === JSON.stringify(option.rule);
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.option, isSelected && styles.selectedOption]}
                    onPress={() => setSelectedRule(option.rule)}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[styles.iconContainer, isSelected && styles.selectedIconContainer]}>
                        <Ionicons 
                          name={option.icon as any} 
                          size={24} 
                          color={isSelected ? '#fff' : '#4ECDC4'} 
                        />
                      </View>
                      <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, isSelected && styles.selectedText]}>
                          {option.title}
                        </Text>
                        <Text style={[styles.optionDescription, isSelected && styles.selectedDescription]}>
                          {option.description}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity 
                style={styles.selectButton} 
                onPress={handleSelect}
              >
                <Text style={styles.selectButtonText}>
                  {selectedRule.type === 'none' ? 'Send Normal Message' : 'Send Ephemeral Message'}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
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
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#f0fffe',
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
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  selectedIconContainer: {
    backgroundColor: '#4ECDC4',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  selectedText: {
    color: '#4ECDC4',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  selectedDescription: {
    color: '#4ECDC4',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  selectButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});