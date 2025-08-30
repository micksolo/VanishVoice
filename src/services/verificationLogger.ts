import { supabase } from './supabase';

export type VerificationType = 'completed' | 'skipped' | 'failed' | 'key_changed' | 'mitm_detected';

interface VerificationLogData {
  sessionId: string;
  partnerId: string;
  verificationType: VerificationType;
  keyFingerprint?: string;
  emojisMatched?: boolean;
}

class VerificationLogger {
  async logVerificationEvent(data: VerificationLogData): Promise<boolean> {
    try {
      console.log('[VerificationLogger] Logging verification event:', data);
      
      const { error } = await supabase.rpc('log_verification_event', {
        p_session_id: data.sessionId,
        p_partner_id: data.partnerId,
        p_verification_type: data.verificationType,
        p_key_fingerprint: data.keyFingerprint || null,
        p_emojis_matched: data.emojisMatched ?? null
      });

      if (error) {
        console.error('[VerificationLogger] Error logging verification:', error);
        return false;
      }

      console.log('[VerificationLogger] Successfully logged verification event');
      return true;
    } catch (error) {
      console.error('[VerificationLogger] Exception logging verification:', error);
      return false;
    }
  }

  async logVerificationCompleted(
    sessionId: string, 
    partnerId: string, 
    keyFingerprint: string
  ): Promise<boolean> {
    return this.logVerificationEvent({
      sessionId,
      partnerId,
      verificationType: 'completed',
      keyFingerprint,
      emojisMatched: true
    });
  }

  async logVerificationSkipped(
    sessionId: string, 
    partnerId: string, 
    keyFingerprint?: string
  ): Promise<boolean> {
    return this.logVerificationEvent({
      sessionId,
      partnerId,
      verificationType: 'skipped',
      keyFingerprint,
      emojisMatched: null
    });
  }

  async logVerificationFailed(
    sessionId: string, 
    partnerId: string, 
    keyFingerprint: string
  ): Promise<boolean> {
    return this.logVerificationEvent({
      sessionId,
      partnerId,
      verificationType: 'failed',
      keyFingerprint,
      emojisMatched: false
    });
  }

  async logKeyChanged(
    sessionId: string, 
    partnerId: string, 
    newFingerprint: string
  ): Promise<boolean> {
    return this.logVerificationEvent({
      sessionId,
      partnerId,
      verificationType: 'key_changed',
      keyFingerprint: newFingerprint
    });
  }

  async logSecurityIncident(
    sessionId: string,
    partnerId: string,
    incidentType: string,
    details: {
      reason?: string;
      emojis?: string[];
      fingerprint?: string;
      securityBits?: number;
    }
  ): Promise<boolean> {
    try {
      console.log('[VerificationLogger] Logging security incident:', { incidentType, details });
      
      // Log as MITM detection event
      const success = await this.logVerificationEvent({
        sessionId,
        partnerId,
        verificationType: 'mitm_detected',
        keyFingerprint: details.fingerprint,
        emojisMatched: false
      });
      
      // Additional security incident logging could go here
      // (e.g., to a dedicated security_incidents table with more details)
      
      if (success) {
        console.log('[VerificationLogger] Security incident logged successfully');
      }
      
      return success;
    } catch (error) {
      console.error('[VerificationLogger] Error logging security incident:', error);
      return false;
    }
  }

  async getVerificationHistory(sessionId: string): Promise<any[] | null> {
    try {
      const { data, error } = await supabase
        .from('verification_logs')
        .select('*')
        .or(`session_id.eq.${sessionId},partner_id.eq.${sessionId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[VerificationLogger] Error fetching history:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[VerificationLogger] Exception fetching history:', error);
      return null;
    }
  }
}

export default new VerificationLogger();