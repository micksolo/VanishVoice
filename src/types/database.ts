export interface User {
  id: string;
  anon_id: string;
  created_at: string;
  friend_code?: string; // For adding friends
  username?: string; // Custom username
  avatar_seed?: string; // For avatar colors
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  type: 'text' | 'voice' | 'video';
  content: string; // Encrypted content or key
  media_path?: string;
  nonce?: string; // Encryption nonce
  video_nonce?: string; // Video-specific nonce for nacl.secretbox
  expiry_rule: ExpiryRule;
  created_at: string;
  viewed_at?: string; // When message was first viewed
  listened_at?: string; // When voice/video was first played
  read_at?: string; // When text message was read
  expired: boolean;
  is_encrypted: boolean;
  duration?: number; // For voice/video messages
}

export type ExpiryType = 'none' | 'view' | 'time' | 'location' | 'event' | 'playback' | 'read';

export interface NoExpiryRule {
  type: 'none';
}

export interface ViewExpiryRule {
  type: 'view';
  disappear_after_view: boolean;
}

export interface TimeExpiryRule {
  type: 'time';
  duration_sec: number;
}

export interface PlaybackExpiryRule {
  type: 'playback';
  // Expires immediately after first playback (for voice/video)
}

export interface ReadExpiryRule {
  type: 'read';
  // Expires immediately after first read (for text)
}

export interface LocationExpiryRule {
  type: 'location';
  radius_m: number;
  lat: number;
  lng: number;
}

export interface EventExpiryRule {
  type: 'event';
  event_id: string;
}

export type ExpiryRule = 
  | NoExpiryRule 
  | ViewExpiryRule 
  | TimeExpiryRule 
  | PlaybackExpiryRule 
  | ReadExpiryRule
  | LocationExpiryRule 
  | EventExpiryRule;

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
}