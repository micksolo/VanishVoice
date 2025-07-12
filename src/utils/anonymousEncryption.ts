import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

interface Session {
  sessionId: string;
  publicKey: string;
  privateKey: string;
}

class AnonymousEncryption {
  private mySession: Session | null = null;
  private partnerPublicKey: Uint8Array | null = null;
  private sharedSecret: Uint8Array | null = null;
  private conversationId: string | null = null;

  async initialize(mySession: Session, partnerId: string) {
    this.mySession = mySession;
    
    // Exchange keys through database
    await this.exchangeKeys(partnerId);
    
    // Derive shared secret
    this.deriveSharedSecret();
  }

  private async exchangeKeys(partnerId: string) {
    if (!this.mySession) throw new Error('Session not initialized');

    try {
      console.log('[AnonymousEncryption] Starting key exchange...');
      console.log('My session:', this.mySession.sessionId);
      console.log('Partner ID:', partnerId);

      // Share our public key
      const { error: insertError } = await supabase
        .from('key_exchange')
        .upsert({
          session_id: this.mySession.sessionId,
          public_key: this.mySession.publicKey,
          for_partner: partnerId,
        });

      if (insertError) {
        console.error('Error inserting key:', insertError);
        throw insertError;
      }

      console.log('[AnonymousEncryption] Our key shared successfully');

      // Wait for partner's key (with timeout)
      let attempts = 0;
      const maxAttempts = 20; // 10 seconds

      while (attempts < maxAttempts) {
        const { data, error: selectError } = await supabase
          .from('key_exchange')
          .select('public_key')
          .eq('session_id', partnerId)
          .eq('for_partner', this.mySession.sessionId)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          console.error('Error fetching partner key:', selectError);
        }

        if (data?.public_key) {
          console.log('[AnonymousEncryption] Partner key received!');
          this.partnerPublicKey = Buffer.from(data.public_key, 'base64');
          return;
        }

        // Wait 500ms before retry
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        
        if (attempts % 4 === 0) {
          console.log(`[AnonymousEncryption] Still waiting for partner key... (${attempts}/20)`);
        }
      }

      throw new Error('Key exchange timeout');
    } catch (error) {
      console.error('Key exchange error:', error);
      throw error;
    }
  }

  private deriveSharedSecret() {
    if (!this.mySession || !this.partnerPublicKey) {
      throw new Error('Keys not available for shared secret');
    }

    const mySecretKey = Buffer.from(this.mySession.privateKey, 'base64');
    
    // Use NaCl box.before to compute shared secret
    this.sharedSecret = nacl.box.before(this.partnerPublicKey, mySecretKey);
  }

  async encryptMessage(plaintext: string): Promise<{ ciphertext: string; nonce: string }> {
    if (!this.sharedSecret) {
      throw new Error('Shared secret not established');
    }

    // Generate random nonce
    const nonce = nacl.randomBytes(24);
    
    // Convert message to bytes
    const messageBytes = Buffer.from(plaintext, 'utf8');
    
    // Encrypt using shared secret
    const encrypted = nacl.box.after(messageBytes, nonce, this.sharedSecret);
    
    return {
      ciphertext: Buffer.from(encrypted).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  async decryptMessage(ciphertext: string, nonceStr: string): Promise<string> {
    if (!this.sharedSecret) {
      throw new Error('Shared secret not established');
    }

    try {
      const encrypted = Buffer.from(ciphertext, 'base64');
      const nonce = Buffer.from(nonceStr, 'base64');
      
      // Decrypt using shared secret
      const decrypted = nacl.box.open.after(encrypted, nonce, this.sharedSecret);
      
      if (!decrypted) {
        throw new Error('Decryption failed');
      }
      
      return Buffer.from(decrypted).toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  // For file encryption (voice/video)
  async encryptFile(data: Uint8Array): Promise<{ ciphertext: Uint8Array; nonce: string }> {
    if (!this.sharedSecret) {
      throw new Error('Shared secret not established');
    }

    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(data, nonce, this.sharedSecret);
    
    return {
      ciphertext: encrypted,
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  async decryptFile(ciphertext: Uint8Array, nonceStr: string): Promise<Uint8Array> {
    if (!this.sharedSecret) {
      throw new Error('Shared secret not established');
    }

    const nonce = Buffer.from(nonceStr, 'base64');
    const decrypted = nacl.box.open.after(ciphertext, nonce, this.sharedSecret);
    
    if (!decrypted) {
      throw new Error('File decryption failed');
    }
    
    return decrypted;
  }

  // Clean up keys after conversation
  async cleanup() {
    if (this.mySession?.sessionId) {
      // Remove from key exchange
      await supabase
        .from('key_exchange')
        .delete()
        .eq('session_id', this.mySession.sessionId);
    }

    // Clear local data
    this.mySession = null;
    this.partnerPublicKey = null;
    this.sharedSecret = null;
  }
}

export default AnonymousEncryption;