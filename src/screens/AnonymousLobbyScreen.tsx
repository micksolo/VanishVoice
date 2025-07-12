import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAnonymousSession } from '../hooks/useAnonymousSession';
import matchingEngine from '../services/matching';

export default function AnonymousLobbyScreen({ navigation }: any) {
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

  const showPremiumAlert = () => {
    Alert.alert(
      'Premium Feature',
      'Gender and location filters are available with WYD Premium for $4.99/month.',
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
            
            // Navigate to chat screen
            setTimeout(() => {
              navigation.navigate('AnonymousChat', {
                conversationId: result.conversationId,
                partnerId: result.partnerId
              });
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

  if (sessionLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </SafeAreaView>
    );
  }

  if (sessionError) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Error: {sessionError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Random Connect</Text>
          <Text style={styles.subtitle}>Find someone to chat with</Text>
        </View>

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
                    <Ionicons name="star" size={12} color="#FFD700" />
                  </View>
                  <Text style={styles.filterButtonText}>Male</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.filterButton}
                  onPress={showPremiumAlert}
                >
                  <View style={styles.premiumBadge}>
                    <Ionicons name="star" size={12} color="#FFD700" />
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
                    <Ionicons name="star" size={12} color="#FFD700" />
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
              <Ionicons name="chatbubbles" size={32} color="#fff" />
              <Text style={styles.findButtonText}>Find Someone</Text>
            </TouchableOpacity>
            
            <Text style={styles.securityNote}>
              🔒 E2E Encrypted • Actually Anonymous
            </Text>
          </View>
        )}

        {matchingState === 'searching' && (
          <View style={styles.searchingState}>
            <ActivityIndicator size="large" color="#4ECDC4" />
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

        {/* Debug Info */}
        {session && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>
              Session: {session.sessionId.substring(0, 8)}...
            </Text>
            <Text style={styles.debugText}>
              Trust Score: {(session.trustScore * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  filtersContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 20,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#4ECDC4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 12,
  },
  findButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  securityNote: {
    marginTop: 20,
    fontSize: 14,
    color: '#666',
  },
  searchingState: {
    alignItems: 'center',
  },
  searchingText: {
    fontSize: 18,
    marginTop: 20,
    color: '#1A1A1A',
  },
  searchTime: {
    fontSize: 14,
    marginTop: 8,
    color: '#666',
  },
  cancelButton: {
    marginTop: 30,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  matchedState: {
    alignItems: 'center',
  },
  matchedText: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    color: '#1A1A1A',
  },
  connectingText: {
    fontSize: 16,
    marginTop: 8,
    color: '#666',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  debugInfo: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 20,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
  },
});