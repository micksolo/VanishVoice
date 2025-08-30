"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugRealtimeConnection = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const debugConfig_1 = require("../utils/debugConfig");
// These will be filled in when you create your Supabase project
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: async_storage_1.default,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
    // Enable realtime for message delivery
    realtime: {
        params: {
            eventsPerSecond: 10
        },
        // Add timeout and heartbeat settings
        timeout: 10000,
        heartbeatIntervalMs: 30000,
    },
});
// Debug helper to check realtime connection
const debugRealtimeConnection = () => {
    const channel = exports.supabase.channel('debug-test');
    channel
        .on('system', { event: '*' }, (payload) => {
        (0, debugConfig_1.debugLog)('REALTIME', 'System event:', payload);
    })
        .on('presence', { event: 'sync' }, () => {
        (0, debugConfig_1.debugLog)('REALTIME', 'Presence sync');
    })
        .subscribe((status, err) => {
        (0, debugConfig_1.debugLog)('REALTIME', 'Channel status:', status);
        if (err)
            (0, debugConfig_1.debugLog)('REALTIME', 'Channel error:', err);
        if (status === 'SUBSCRIBED') {
            (0, debugConfig_1.debugLog)('REALTIME', 'Successfully connected to realtime!');
            // Clean up test channel
            setTimeout(() => {
                channel.unsubscribe();
            }, 5000);
        }
    });
};
exports.debugRealtimeConnection = debugRealtimeConnection;
