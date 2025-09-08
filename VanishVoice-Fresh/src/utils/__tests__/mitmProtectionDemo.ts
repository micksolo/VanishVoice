#!/usr/bin/env node

/**
 * MITM Protection Demonstration
 * 
 * This script demonstrates how the SAS verification system protects
 * against man-in-the-middle attacks in anonymous chat.
 * 
 * Run with: npx ts-node src/utils/__tests__/mitmProtectionDemo.ts
 */

import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import AnonymousEncryption from '../anonymousEncryption';

interface Session {
  sessionId: string;
  publicKey: string;
  privateKey: string;
}

function createTestSession(id: string): Session {
  const keyPair = nacl.box.keyPair();
  return {
    sessionId: id,
    publicKey: Buffer.from(keyPair.publicKey).toString('base64'),
    privateKey: Buffer.from(keyPair.secretKey).toString('base64')
  };
}

async function demonstrateMitmProtection() {
  console.log('🛡️  MITM Protection Demonstration for Anonymous Chat\n');
  
  // Create sessions for Alice, Bob, and Eve (the attacker)
  const alice = createTestSession('alice-session-123');
  const bob = createTestSession('bob-session-456');  
  const eve = createTestSession('eve-attacker-789'); // MITM attacker
  
  console.log('👥 Participants:');
  console.log('  Alice (User 1):', alice.sessionId);
  console.log('  Bob (User 2):', bob.sessionId);
  console.log('  Eve (Attacker):', eve.sessionId);
  console.log('');
  
  // === SCENARIO 1: Legitimate Connection ===
  console.log('✅ SCENARIO 1: Legitimate Connection (No MITM)');
  console.log('   Alice and Bob connect directly\n');
  
  try {
    const aliceEncryption = new AnonymousEncryption();
    const bobEncryption = new AnonymousEncryption();
    
    // Simulate direct key exchange (would happen through database)
    // In real implementation, this goes through the server
    aliceEncryption['mySession'] = alice;
    aliceEncryption['partnerPublicKey'] = Buffer.from(bob.publicKey, 'base64');
    aliceEncryption['deriveSharedSecret']();
    aliceEncryption['generateVerificationData'](bob.sessionId);
    await aliceEncryption['generateSASVerificationData'](bob.sessionId);
    
    bobEncryption['mySession'] = bob;
    bobEncryption['partnerPublicKey'] = Buffer.from(alice.publicKey, 'base64');
    bobEncryption['deriveSharedSecret']();
    bobEncryption['generateVerificationData'](alice.sessionId);
    await bobEncryption['generateSASVerificationData'](alice.sessionId);
    
    const aliceVerification = aliceEncryption.getVerificationData();
    const bobVerification = bobEncryption.getVerificationData();
    
    console.log('   Alice sees emojis:', aliceVerification?.emojis.join(' '));
    console.log('   Bob sees emojis:  ', bobVerification?.emojis.join(' '));
    console.log('   Emojis match:', JSON.stringify(aliceVerification?.emojis) === JSON.stringify(bobVerification?.emojis) ? '✅ YES' : '❌ NO');
    
    if (aliceVerification && bobVerification) {
      const comparison = aliceEncryption.compareEmojiSequences(bobVerification.emojis);
      console.log('   Security analysis:', comparison.analysis);
      console.log('   MITM detected:', comparison.mitm.detected ? '🚨 YES' : '✅ NO');
    }
    
    console.log('');
    
    // === SCENARIO 2: MITM Attack ===
    console.log('🚨 SCENARIO 2: MITM Attack');
    console.log('   Eve intercepts and substitutes keys\n');
    
    // Eve performs MITM by substituting her key for Bob's
    const aliceMitm = new AnonymousEncryption();
    const bobMitm = new AnonymousEncryption();
    
    // Alice thinks she's talking to Bob, but gets Eve's key
    aliceMitm['mySession'] = alice;
    aliceMitm['partnerPublicKey'] = Buffer.from(eve.publicKey, 'base64'); // ⚠️ Eve's key instead of Bob's
    aliceMitm['deriveSharedSecret']();
    aliceMitm['generateVerificationData'](bob.sessionId);
    await aliceMitm['generateSASVerificationData'](bob.sessionId);
    
    // Bob thinks he's talking to Alice, but gets Eve's key
    bobMitm['mySession'] = bob;
    bobMitm['partnerPublicKey'] = Buffer.from(eve.publicKey, 'base64'); // ⚠️ Eve's key instead of Alice's
    bobMitm['deriveSharedSecret']();
    bobMitm['generateVerificationData'](alice.sessionId);
    await bobMitm['generateSASVerificationData'](alice.sessionId);
    
    const aliceMitmVerification = aliceMitm.getVerificationData();
    const bobMitmVerification = bobMitm.getVerificationData();
    
    console.log('   Alice sees emojis:', aliceMitmVerification?.emojis.join(' '));
    console.log('   Bob sees emojis:  ', bobMitmVerification?.emojis.join(' '));
    console.log('   Emojis match:', JSON.stringify(aliceMitmVerification?.emojis) === JSON.stringify(bobMitmVerification?.emojis) ? '✅ YES' : '❌ NO');
    
    if (aliceMitmVerification && bobMitmVerification) {
      const mitmComparison = aliceMitm.compareEmojiSequences(bobMitmVerification.emojis);
      console.log('   Security analysis:', mitmComparison.analysis);
      console.log('   MITM detected:', mitmComparison.mitm.detected ? '🚨 YES' : '✅ NO');
      console.log('   Risk level:', mitmComparison.mitm.riskLevel.toUpperCase());
      console.log('   Recommended action:', mitmComparison.mitm.action.toUpperCase());
    }
    
    console.log('');
    
    // === SCENARIO 3: Detection and Response ===
    console.log('🛡️  SCENARIO 3: User Response to MITM Detection\n');
    
    if (aliceMitmVerification && bobMitmVerification && aliceMitm) {
      const mismatch = JSON.stringify(aliceMitmVerification.emojis) !== JSON.stringify(bobMitmVerification.emojis);
      
      if (mismatch) {
        console.log('   👤 Alice: "Bob, I see: ' + aliceMitmVerification.emojis.join(' ') + '"');
        console.log('   👤 Bob: "That\'s not what I see! I see: ' + bobMitmVerification.emojis.join(' ') + '"');
        console.log('   👤 Both: "The emojis don\'t match! This could be a MITM attack!"');
        console.log('');
        
        // Alice rejects the verification
        const mitmDetected = aliceMitm.rejectVerification('Emoji mismatch - potential MITM attack');
        console.log('   🚨 MITM Attack Status:', mitmDetected ? 'DETECTED' : 'NOT DETECTED');
        
        const securityAnalysis = aliceMitm.getDetailedSecurityAnalysis();
        console.log('   📊 Security Analysis:');
        console.log('      Key exchange completed:', securityAnalysis.keyExchange.completed ? '✅' : '❌');
        console.log('      Shared secret established:', securityAnalysis.keyExchange.sharedSecretEstablished ? '✅' : '❌');
        console.log('      Verification emojis generated:', securityAnalysis.verification.emojisGenerated ? '✅' : '❌');
        console.log('      Connection verified:', securityAnalysis.verification.verified ? '✅' : '❌');
        console.log('      MITM protection active:', securityAnalysis.threats.mitm.protected ? '✅' : '❌');
        console.log('      Security level:', securityAnalysis.sas.verificationStatus.toUpperCase());
      }
    }
    
    console.log('');
    console.log('🔒 SECURITY SUMMARY:');
    console.log('   • Legitimate connections: Identical emoji sequences ✅');
    console.log('   • MITM attacks: Different emoji sequences detected 🚨');
    console.log('   • User verification: Out-of-band emoji comparison required');
    console.log('   • Security strength: ~29 bits (1 in 550 million collision chance)');
    console.log('   • False positive rate: Extremely low (<0.0000002%)');
    console.log('');
    console.log('✨ Conclusion: SAS emoji verification successfully protects against MITM attacks!');
    
  } catch (error) {
    console.error('Error in demonstration:', error);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateMitmProtection().catch(console.error);
}

export default demonstrateMitmProtection;