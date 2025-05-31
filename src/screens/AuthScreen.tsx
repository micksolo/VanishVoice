import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function AuthScreen() {
  const { signInAnonymously } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleAnonymousSignIn = async () => {
    try {
      setLoading(true);
      await signInAnonymously();
    } catch (error) {
      console.error('Error signing in:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Ionicons name="mic-circle" size={100} color="#000" />
          <Text style={styles.title}>VanishVoice</Text>
          <Text style={styles.subtitle}>Ephemeral Voice Messages</Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Ionicons name="time-outline" size={24} color="#666" />
            <Text style={styles.featureText}>Messages that disappear</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="lock-closed-outline" size={24} color="#666" />
            <Text style={styles.featureText}>End-to-end encrypted</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="location-outline" size={24} color="#666" />
            <Text style={styles.featureText}>Location & time based expiry</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleAnonymousSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="person-outline" size={24} color="#fff" />
              <Text style={styles.buttonText}>Start Anonymously</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          No account needed. Your messages will vanish.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  featuresContainer: {
    marginBottom: 50,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  featureText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  disclaimer: {
    marginTop: 20,
    color: '#999',
    fontSize: 14,
  },
});