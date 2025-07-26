# WYD App - Manual Testing Checklist

## Overview
This checklist covers all implemented features based on the Development Roadmap and recent changes. Test on both iOS and Android devices if possible.

## Prerequisites
- [ ] App is running on physical device or emulator
- [ ] Supabase backend is accessible
- [ ] Push notifications are enabled on device
- [ ] Camera and microphone permissions granted

---

## 1. Authentication & User Management

### Initial Setup
- [ ] App launches without crashes
- [ ] Guest account is automatically created
- [ ] Username is displayed (e.g., "CoolPanda123")
- [ ] Can navigate between all main tabs without errors

### Profile Management
- [ ] Profile screen displays current username
- [ ] Can copy username to clipboard
- [ ] Theme toggle works (light/dark mode)
- [ ] Theme preference persists after app restart

---

## 2. Theme System & UI Components

### Theme System
- [ ] **Light Mode**
  - [ ] All screens have white/light backgrounds
  - [ ] Text is dark and readable
  - [ ] Purple accent color (#6C63FF) is visible
  - [ ] No contrast issues
  
- [ ] **Dark Mode**
  - [ ] All screens have dark backgrounds
  - [ ] Text is light and readable
  - [ ] Purple accent maintains visibility
  - [ ] No harsh contrast transitions

### UI Components
- [ ] Buttons have proper touch targets (44x44 minimum)
- [ ] Loading states show appropriate feedback
- [ ] Empty states display when no content
- [ ] Error states show user-friendly messages
- [ ] Consistent spacing throughout app (4px grid)

---

## 3. Friend System

### Friend Management
- [ ] **Adding Friends**
  - [ ] Can add friend by username
  - [ ] Error shown for invalid username
  - [ ] Success feedback on friend request sent
  - [ ] Cannot add yourself as friend

- [ ] **Friend Requests**
  - [ ] Incoming requests show in Friends tab
  - [ ] Can accept friend request
  - [ ] Can decline friend request
  - [ ] Friend list updates after accept/decline

- [ ] **Friend List**
  - [ ] All friends display with usernames
  - [ ] Unread message count shows correctly
  - [ ] Can tap friend to open chat
  - [ ] Swipe to delete friend works
  - [ ] Deletion removes friend for both users

---

## 4. Friend Chat - Text Messages

### Sending Text Messages
- [ ] Text input field is accessible
- [ ] Can type and send text message
- [ ] Message appears immediately in chat
- [ ] Sender sees message on right side
- [ ] Message bubble uses theme colors correctly

### Receiving Text Messages
- [ ] Push notification received for new message
- [ ] Message appears in chat without refresh
- [ ] Recipient sees message on left side
- [ ] Unread count updates in friend list

### E2E Encryption Verification
- [ ] Messages are encrypted (check Supabase dashboard - no plaintext visible)
- [ ] Messages decrypt properly for recipient
- [ ] Old messages remain accessible

---

## 5. Friend Chat - Voice Messages

### Recording Voice Messages
- [ ] **Tap to Record**
  - [ ] Tap record button to start recording
  - [ ] Waveform visualizer shows during recording
  - [ ] Duration counter increments
  - [ ] Tap again to stop recording
  
- [ ] **Recording Feedback**
  - [ ] Clear visual indication when recording
  - [ ] Can cancel recording by swiping away
  - [ ] Maximum duration enforced (if implemented)

### Sending Voice Messages
- [ ] Upload progress indicator shows
- [ ] Success feedback on send
- [ ] Voice message appears in chat with duration
- [ ] Proper error handling for upload failures

### Playing Voice Messages
- [ ] Tap message to play
- [ ] Playback controls work (play/pause)
- [ ] Audio plays clearly on both platforms
- [ ] Progress indicator shows playback position
- [ ] Can replay message multiple times

---

## 6. Friend Chat - Video Messages

### Recording Video Messages
- [ ] **Camera Interface**
  - [ ] Camera preview loads properly
  - [ ] Front/back camera toggle works
  - [ ] 30-second countdown timer visible
  - [ ] Recording stops at 30 seconds automatically

- [ ] **Recording Process**
  - [ ] Tap to start recording
  - [ ] Visual feedback during recording
  - [ ] Can stop recording early
  - [ ] Preview shown after recording (if implemented)

### Sending Video Messages
- [ ] Upload progress shows (expect ~30s for upload)
- [ ] Progress percentage updates smoothly
- [ ] Success feedback on completion
- [ ] Video thumbnail appears in chat

### Playing Video Messages
- [ ] Download progress shows (~4s expected)
- [ ] Video plays in modal/fullscreen
- [ ] Playback controls available
- [ ] Audio and video sync properly
- [ ] Can close video player

---

## 7. Anonymous Chat

### Matching System
- [ ] "Connect with Stranger" button works
- [ ] Finding match shows loading state
- [ ] Successfully matches with another user
- [ ] Can exit queue if no match found

### Anonymous Messaging
- [ ] Can send text messages
- [ ] Can send voice messages
- [ ] Can send video messages
- [ ] Messages are E2E encrypted
- [ ] No username shown (anonymous)
- [ ] Can end conversation and rematch

---

## 8. Ephemeral Messaging (If Implemented)

### Message Expiry Rules
- [ ] **Expiry Selector**
  - [ ] Can choose "Never expires"
  - [ ] Can choose "Disappear after viewing"
  - [ ] Can choose time-based expiry (1h, 1d, 1w)
  - [ ] Selected rule shows on message

### Ephemeral Indicators
- [ ] Messages show ephemeral icon/indicator
- [ ] Countdown timer visible (for time-based)
- [ ] "This message will disappear" warning shown

### Expiry Behavior
- [ ] View-once messages disappear after viewing
- [ ] Time-based messages expire on schedule
- [ ] Expired messages removed from chat
- [ ] Cannot screenshot ephemeral messages (if implemented)

---

## 9. Push Notifications

### Notification Delivery
- [ ] **Foreground**
  - [ ] In-app notification banner appears
  - [ ] Can tap to navigate to message

- [ ] **Background**
  - [ ] System notification appears
  - [ ] Notification sound plays
  - [ ] App badge count updates

- [ ] **App Killed**
  - [ ] Notifications still received
  - [ ] Tap opens app to correct chat

### Notification Content
- [ ] Shows sender username (for friends)
- [ ] Shows message preview (if not ephemeral)
- [ ] "New message" for ephemeral content
- [ ] Anonymous chat shows "New anonymous message"

---

## 10. Performance & Reliability

### General Performance
- [ ] App remains responsive during all operations
- [ ] No memory leaks during extended use
- [ ] Smooth scrolling in all lists
- [ ] Animations run at 60fps

### Network Handling
- [ ] Offline mode shows appropriate errors
- [ ] Messages queue when offline (if implemented)
- [ ] Reconnection handled gracefully
- [ ] No duplicate messages on reconnect

### Media Handling
- [ ] Large video files handle properly
- [ ] Audio plays without stuttering
- [ ] Media caches appropriately
- [ ] Storage cleaned up properly

---

## 11. Edge Cases & Error Handling

### Error Scenarios
- [ ] Network timeout shows user-friendly error
- [ ] Invalid media files handled gracefully
- [ ] Permissions denied shows helpful message
- [ ] Server errors don't crash app

### Edge Cases
- [ ] Rapid message sending works correctly
- [ ] Switching between chats maintains state
- [ ] Background/foreground transitions smooth
- [ ] Deep linking works (if implemented)

---

## 12. Security Verification

### E2E Encryption
- [ ] Check Supabase dashboard:
  - [ ] Text messages show as encrypted
  - [ ] Voice message URLs are encrypted
  - [ ] Video message URLs are encrypted
  - [ ] No plaintext keys in database

### Privacy
- [ ] No message content in push notifications (if ephemeral)
- [ ] Media files not accessible without keys
- [ ] Anonymous chat truly anonymous
- [ ] Friend connections properly isolated

---

## Testing Notes

### Platform-Specific Issues to Watch
- **iOS**: Audio playback in silent mode
- **Android**: Background notification handling
- **Both**: Video recording quality/size

### Known Limitations
- Video files are large (~50MB for 30s)
- Upload takes ~30 seconds
- No video compression available

### Debug Tools
- Check Realtime debugger (if visible)
- Monitor console for errors
- Verify push token registration

---

## Sign-off

- [ ] All critical features tested
- [ ] No blocking bugs found
- [ ] Performance acceptable
- [ ] Security measures verified
- [ ] Ready for commit

**Tested by**: _______________
**Date**: _______________
**Platform**: iOS / Android
**Device**: _______________