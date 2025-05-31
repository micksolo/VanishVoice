import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { supabase } from '../services/supabase';

interface Message {
  id: string;
  sender_id: string;
  created_at: string;
  listened_at: string | null;
  expiry_rule: any;
  sender?: {
    friend_code: string;
  };
}

export default function InboxScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMessages();
      // TODO: Re-enable realtime subscriptions after fixing WebSocket issue
      // subscribeToMessages();
    }
  }, [user]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(friend_code)
        `)
        .eq('recipient_id', user?.id)
        .eq('expired', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user?.id}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const getExpiryText = (expiryRule: any) => {
    switch (expiryRule.type) {
      case 'time':
        return `Expires in ${expiryRule.duration_sec}s`;
      case 'geo':
        return `Location-based (${expiryRule.radius_m}m)`;
      case 'event':
        return 'Event-based';
      default:
        return 'Unknown';
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <TouchableOpacity style={styles.messageItem}>
      <View style={styles.messageIcon}>
        <Ionicons 
          name={item.listened_at ? 'mail-open-outline' : 'mail-outline'} 
          size={24} 
          color={item.listened_at ? '#999' : '#000'} 
        />
      </View>
      <View style={styles.messageContent}>
        <Text style={styles.senderText}>
          From: {item.sender?.friend_code || 'Anonymous'}
        </Text>
        <Text style={styles.timeText}>{getTimeAgo(item.created_at)}</Text>
        <Text style={styles.expiryText}>{getExpiryText(item.expiry_rule)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="mail-outline" size={80} color="#ddd" />
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>
        Messages sent to you will appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={EmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchMessages();
          }} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  emptyContainer: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageIcon: {
    marginRight: 15,
  },
  messageContent: {
    flex: 1,
  },
  senderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  expiryText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    color: '#333',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
});