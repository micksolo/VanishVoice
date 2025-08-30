/**
 * Zero-Knowledge Audio Test Component
 * 
 * This component provides a simple UI to test and verify that
 * zero-knowledge audio encryption is working correctly.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { quickZKAudioTest, VerificationResult, verifyZeroKnowledgeAudioSecurity } from '../utils/verifyZeroKnowledgeAudio';

interface ZeroKnowledgeAudioTestProps {
  onTestComplete?: (success: boolean, result?: VerificationResult) => void;
}

export default function ZeroKnowledgeAudioTest({ onTestComplete }: ZeroKnowledgeAudioTestProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null);

  const runQuickTest = async () => {
    setIsRunning(true);
    try {
      console.log('🧪 Starting Zero-Knowledge Audio Quick Test...');
      const success = await quickZKAudioTest();
      
      Alert.alert(
        'Quick Test Complete',
        success 
          ? '✅ Zero-knowledge audio encryption is working!' 
          : '❌ Zero-knowledge audio encryption test failed!',
        [{ text: 'OK' }]
      );
      
      onTestComplete?.(success);
    } catch (error) {
      console.error('Quick test error:', error);
      Alert.alert('Test Error', `Failed to run test: ${error.message}`);
      onTestComplete?.(false);
    } finally {
      setIsRunning(false);
    }
  };

  const runFullTest = async () => {
    setIsRunning(true);
    try {
      console.log('🧪 Starting Full Zero-Knowledge Audio Verification...');
      const result = await verifyZeroKnowledgeAudioSecurity();
      setLastResult(result);
      
      const message = result.success 
        ? '✅ All zero-knowledge tests passed!\n\nServer CANNOT decrypt any audio messages!'
        : `❌ Zero-knowledge verification failed!\n\nErrors: ${result.errors.join(', ')}`;
      
      Alert.alert('Full Test Complete', message, [{ text: 'OK' }]);
      
      onTestComplete?.(result.success, result);
    } catch (error) {
      console.error('Full test error:', error);
      Alert.alert('Test Error', `Failed to run test: ${error.message}`);
      onTestComplete?.(false);
    } finally {
      setIsRunning(false);
    }
  };

  const renderTestResult = () => {
    if (!lastResult) return null;

    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>Last Test Results:</Text>
        
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Overall Success:</Text>
          <Text style={[styles.resultValue, lastResult.success ? styles.success : styles.failure]}>
            {lastResult.success ? '✅ PASS' : '❌ FAIL'}
          </Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>NaCl Encryption:</Text>
          <Text style={[styles.resultValue, lastResult.details.naclEncryption ? styles.success : styles.failure]}>
            {lastResult.details.naclEncryption ? '✅' : '❌'}
          </Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Friend Encryption:</Text>
          <Text style={[styles.resultValue, lastResult.details.friendEncryption ? styles.success : styles.failure]}>
            {lastResult.details.friendEncryption ? '✅' : '❌'}
          </Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Audio Encryption:</Text>
          <Text style={[styles.resultValue, lastResult.details.audioEncryption ? styles.success : styles.failure]}>
            {lastResult.details.audioEncryption ? '✅' : '❌'}
          </Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Zero-Knowledge:</Text>
          <Text style={[styles.resultValue, lastResult.details.zeroKnowledgeConfirmed ? styles.success : styles.failure]}>
            {lastResult.details.zeroKnowledgeConfirmed ? '✅' : '❌'}
          </Text>
        </View>

        {lastResult.warnings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Warnings:</Text>
            {lastResult.warnings.map((warning, index) => (
              <Text key={index} style={styles.warning}>• {warning}</Text>
            ))}
          </View>
        )}

        {lastResult.errors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>❌ Errors:</Text>
            {lastResult.errors.map((error, index) => (
              <Text key={index} style={styles.error}>• {error}</Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Zero-Knowledge Audio Encryption Test</Text>
      <Text style={styles.subtitle}>
        Verify that the server cannot decrypt any audio messages
      </Text>

      <TouchableOpacity 
        style={[styles.button, styles.primaryButton]} 
        onPress={runQuickTest}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Running...' : '🚀 Quick Test'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton]} 
        onPress={runFullTest}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Running...' : '🔍 Full Verification'}
        </Text>
      </TouchableOpacity>

      {renderTestResult()}

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>What this tests:</Text>
        <Text style={styles.infoText}>• NaCl cryptographic foundation</Text>
        <Text style={styles.infoText}>• Friend key exchange system</Text>
        <Text style={styles.infoText}>• Audio-specific encryption</Text>
        <Text style={styles.infoText}>• Server inability to decrypt</Text>
        <Text style={styles.infoText}>• AEAD integrity protection</Text>
        <Text style={styles.infoText}>• Perfect Forward Secrecy</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#FF6B35',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginVertical: 20,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  resultLabel: {
    fontSize: 16,
    color: '#333',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  success: {
    color: '#28a745',
  },
  failure: {
    color: '#dc3545',
  },
  section: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  warning: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 5,
  },
  error: {
    fontSize: 14,
    color: '#721c24',
    marginBottom: 5,
  },
  infoSection: {
    backgroundColor: '#e9f7ff',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0066cc',
  },
  infoText: {
    fontSize: 14,
    color: '#0066cc',
    marginBottom: 3,
  },
});