import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme';
import { useAnonymousSession } from '../hooks/useAnonymousSession';
import matchingEngine from '../services/matching';

interface RandomChatModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToChat: (conversationId: string, partnerId: string) => void;
}

export default function RandomChatModal({ visible, onClose, onNavigateToChat }: RandomChatModalProps) {
  const theme = useAppTheme();
  const { session, loading: sessionLoading, error: sessionError } = useAnonymousSession();
  const [matchingState, setMatchingState] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [matchData, setMatchData] = useState<any>(null);
  const [searchTime, setSearchTime] = useState(0);
  const [selectedGender, setSelectedGender] = useState<'anyone' | 'male' | 'female'>('anyone');
  const [selectedLocation, setSelectedLocation] = useState<'worldwide' | 'country'>('worldwide');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (matchingState === 'searching') {
      interval = setInterval(() => {
        setSearchTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [matchingState]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setMatchingState('idle');
      setSearchTime(0);
      setMatchData(null);
    }
  }, [visible]);

  const showPremiumAlert = () => {
    Alert.alert(
      'Premium Feature',
      'Gender and location filters are available with VanishVoice Premium for $4.99/month.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Learn More', onPress: () => {/* Navigate to premium screen */} }
      ]
    );
  };

  const findMatch = async () => {
    if (!session) {
      Alert.alert('Error', 'No session available');
      return;
    }

    try {
      setMatchingState('searching');
      setSearchTime(0);

      await matchingEngine.findMatch(
        session.sessionId,
        {}, // No preferences for now
        (result) => {
          if (result.matched) {
            setMatchData(result);
            setMatchingState('matched');
            
            // Navigate to chat screen after short delay
            setTimeout(() => {
              onClose(); // Close modal first
              onNavigateToChat(result.conversationId, result.partnerId);
            }, 1500);
          }
        }
      );
    } catch (error) {
      console.error('Error finding match:', error);
      Alert.alert('Error', 'Failed to find match');
      setMatchingState('idle');
    }
  };

  const cancelSearch = async () => {
    if (!session) return;

    try {
      await matchingEngine.cancelSearch(session.sessionId);
      setMatchingState('idle');
      setSearchTime(0);
    } catch (error) {
      console.error('Error canceling search:', error);
    }
  };

  const handleClose = () => {
    if (matchingState === 'searching') {
      cancelSearch();
    }
    onClose();
  };

  const styles = getStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Random Chat</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {sessionLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.text.accent} />
              <Text style={styles.loadingText}>Initializing...</Text>
            </View>
          ) : sessionError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error: {sessionError}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>Find someone to chat with</Text>

              {/* Filters */}
              {matchingState === 'idle' && (
                <View style={styles.filtersContainer}>
                  <Text style={styles.filtersTitle}>Filters</Text>
                  
                  {/* Gender Filter */}
                  <View style={styles.filterSection}>
                    <Text style={styles.filterLabel}>Gender</Text>
                    <View style={styles.filterOptions}>
                      <TouchableOpacity 
                        style={[styles.filterButton, selectedGender === 'anyone' && styles.filterButtonActive]}
                        onPress={() => setSelectedGender('anyone')}
                      >
                        <Text style={[styles.filterButtonText, selectedGender === 'anyone' && styles.filterButtonTextActive]}>Anyone</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.filterButton}
                        onPress={showPremiumAlert}
                      >
                        <View style={styles.premiumBadge}>
                          <Ionicons name="star" size={12} color={theme.colors.status.warning} />
                        </View>
                        <Text style={styles.filterButtonText}>Male</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.filterButton}
                        onPress={showPremiumAlert}
                      >
                        <View style={styles.premiumBadge}>
                          <Ionicons name="star" size={12} color={theme.colors.status.warning} />
                        </View>
                        <Text style={styles.filterButtonText}>Female</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Location Filter */}
                  <View style={styles.filterSection}>
                    <Text style={styles.filterLabel}>Location</Text>
                    <View style={styles.filterOptions}>
                      <TouchableOpacity 
                        style={[styles.filterButton, selectedLocation === 'worldwide' && styles.filterButtonActive]}
                        onPress={() => setSelectedLocation('worldwide')}
                      >
                        <Text style={[styles.filterButtonText, selectedLocation === 'worldwide' && styles.filterButtonTextActive]}>Worldwide</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.filterButton}
                        onPress={showPremiumAlert}
                      >
                        <View style={styles.premiumBadge}>
                          <Ionicons name="star" size={12} color={theme.colors.status.warning} />
                        </View>
                        <Text style={styles.filterButtonText}>My Country</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Main Content */}
              {matchingState === 'idle' && (
                <View style={styles.idleState}>
                  <TouchableOpacity style={styles.findButton} onPress={findMatch}>
                    <Ionicons name="chatbubbles" size={32} color={theme.colors.text.inverse} />
                    <Text style={styles.findButtonText}>Find Someone</Text>
                  </TouchableOpacity>
                  
                  <Text style={styles.securityNote}>
                    🔒 E2E Encrypted • Actually Anonymous
                  </Text>
                </View>
              )}

              {matchingState === 'searching' && (
                <View style={styles.searchingState}>
                  <ActivityIndicator size="large" color={theme.colors.text.accent} />
                  <Text style={styles.searchingText}>Finding someone...</Text>
                  <Text style={styles.searchTime}>{searchTime}s</Text>
                  
                  <TouchableOpacity style={styles.cancelButton} onPress={cancelSearch}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {matchingState === 'matched' && (
                <View style={styles.matchedState}>
                  <Ionicons name="checkmark-circle" size={80} color="#4ECDC4" />
                  <Text style={styles.matchedText}>Match Found!</Text>
                  <Text style={styles.connectingText}>Connecting...</Text>
                </View>
              )}

              {/* Debug Info - Only show in development */}
              {__DEV__ && session && (
                <View style={styles.debugInfo}>
                  <Text style={styles.debugText}>
                    Session: {session.sessionId.substring(0, 8)}...
                  </Text>
                  <Text style={styles.debugText}>
                    Trust Score: {(session.trustScore * 100).toFixed(0)}%
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  title: {
    ...theme.typography.headlineMedium,
    color: theme.colors.text.primary,
  },
  placeholder: {
    width: 32, // Same width as close button for centering
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  subtitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.status.error,
    textAlign: 'center',
  },
  filtersContainer: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  filtersTitle: {
    ...theme.typography.headlineSmall,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  },
  filterSection: {
    marginBottom: theme.spacing.lg,
  },
  filterLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    fontWeight: '500',
    marginBottom: theme.spacing.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.background.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.text.accent,
    borderColor: theme.colors.text.accent,
  },
  filterButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
  },
  filterButtonTextActive: {
    color: theme.colors.text.inverse,
    fontWeight: '500',
  },
  premiumBadge: {
    // Small star icon for premium features
  },
  idleState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  findButton: {
    backgroundColor: theme.colors.text.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 12,
    shadowColor: theme.colors.text.accent,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  findButtonText: {
    color: theme.colors.text.inverse,
    ...theme.typography.headlineSmall,
    fontWeight: '600',
  },
  securityNote: {
    marginTop: theme.spacing.lg,
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  searchingState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  searchingText: {
    ...theme.typography.headlineSmall,
    marginTop: theme.spacing.lg,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  searchTime: {
    ...theme.typography.bodyMedium,
    marginTop: theme.spacing.xs,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 20,
  },
  cancelButtonText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
  },
  matchedState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  matchedText: {
    ...theme.typography.displaySmall,
    fontWeight: '600',
    marginTop: theme.spacing.lg,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  connectingText: {
    ...theme.typography.bodyMedium,
    marginTop: theme.spacing.xs,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  debugInfo: {
    backgroundColor: theme.colors.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: theme.spacing.lg,
  },
  debugText: {
    ...theme.typography.labelSmall,
    color: theme.colors.text.secondary,
  },
});