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
import { useAppTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function AuthScreen() {
  const { signInAnonymously } = useAuth();
  const theme = useAppTheme();
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Ionicons name="mic-circle" size={100} color={theme.colors.text.primary} />
          <Text style={[styles.title, theme.typography.displayLarge, { color: theme.colors.text.primary }]}>VanishVoice</Text>
          <Text style={[styles.subtitle, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>Ephemeral Voice Messages</Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Ionicons name="time-outline" size={24} color={theme.colors.text.secondary} />
            <Text style={[styles.featureText, theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>Messages that disappear</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="lock-closed-outline" size={24} color={theme.colors.text.secondary} />
            <Text style={[styles.featureText, theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>End-to-end encrypted</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="location-outline" size={24} color={theme.colors.text.secondary} />
            <Text style={[styles.featureText, theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>Location & time based expiry</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.button.primary.background }]}
          onPress={handleAnonymousSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.button.primary.text} />
          ) : (
            <>
              <Ionicons name="person-outline" size={24} color={theme.colors.button.primary.text} />
              <Text style={[styles.buttonText, theme.typography.buttonLarge, { color: theme.colors.button.primary.text }]}>Start Anonymously</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.disclaimer, theme.typography.bodySmall, { color: theme.colors.text.tertiary }]}>
          No account needed. Your messages will vanish.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginTop: 20,
  },
  subtitle: {
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
  },
  button: {
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    marginLeft: 10,
  },
  disclaimer: {
    marginTop: 20,
  },
});