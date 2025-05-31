export interface User {
  id: string;
  anon_id: string;
  created_at: string;
  friend_code?: string; // For adding friends
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  media_path: string;
  expiry_rule: ExpiryRule;
  created_at: string;
  listened_at?: string;
  expired: boolean;
  encryption_key?: string; // Store encrypted key
}

export type ExpiryType = 'time' | 'location' | 'event';

export interface TimeExpiryRule {
  type: 'time';
  duration_sec: number;
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

export type ExpiryRule = TimeExpiryRule | LocationExpiryRule | EventExpiryRule;

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
}