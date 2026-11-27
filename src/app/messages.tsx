import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth_context';
import { supabase } from '../lib/supabase';
import Navigation from './navbar';

interface ChatMessage {
  id: string;
  sender_id: number;
  text: string;
  timestamp: string;
}

interface ConversationThread {
  requestId: number;
  partnerId: number;
  partnerName: string;
  partnerAvatar?: string | null;
  skillName: string;
  status: string;
  unreadCount: number;
  messages: ChatMessage[];
}

function getAvatarUri(name?: string, avatarUrl?: string | null): string {
  if (avatarUrl && avatarUrl.trim().length > 0) return avatarUrl;
  const encoded = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encoded}&background=7C3AED&color=FFFFFF&bold=true`;
}

function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessagePage() {
  const { userId } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftText, setDraftText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function loadConversations() {
      setLoading(true);

      const { data, error } = await supabase
        .from('swap_requests')
        .select(`
          id,
          status,
          requester_id,
          receiver_id,
          requester:users!requester_id ( id, full_name, avatar_url ),
          receiver:users!receiver_id ( id, full_name, avatar_url ),
          skill:skills!requested_skill_id ( name )
        `)
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
        .in('status', ['ACCEPTED', 'PENDING'])
        .order('id', { ascending: false });

      if (error) {
        console.error('Failed to load conversations:', error.message);
        setLoading(false);
        return;
      }

      // Deduplicate by partner so each swap partner has a clean conversation thread
      const seenPartners = new Set<number>();
      const builtThreads: ConversationThread[] = [];

      (data || []).forEach((item: any, idx: number) => {
        const isRequester = item.requester_id === userId;
        const partner = isRequester ? item.receiver : item.requester;
        const partnerId = isRequester ? item.receiver_id : item.requester_id;

        if (!partnerId || seenPartners.has(partnerId)) return;
        seenPartners.add(partnerId);

        const skillName = item.skill?.name ?? 'Skill Swap';
        const partnerName = partner?.full_name ?? 'SkillSwap Member';

        builtThreads.push({
          requestId: item.id,
          partnerId,
          partnerName,
          partnerAvatar: partner?.avatar_url,
          skillName,
          status: item.status,
          unreadCount: idx === 0 ? 1 : 0,
          messages: [
            {
              id: `welcome-${item.id}-1`,
              sender_id: partnerId,
              text:
                item.status === 'ACCEPTED'
                  ? `Hi! Excited for our ${skillName} session. Let me know what topics you want to cover first.`
                  : `Hey! I saw the swap request for ${skillName}. Are you free this week?`,
              timestamp: '10:15 AM',
            },
          ],
        });
      });

      setThreads(builtThreads);
      setLoading(false);
    }

    loadConversations();
  }, [userId]);

  const activeThread =
    threads.find((t) => t.requestId === activeRequestId) ?? null;

  function openThread(requestId: number) {
    setActiveRequestId(requestId);
    setThreads((prev) =>
      prev.map((t) =>
        t.requestId === requestId ? { ...t, unreadCount: 0 } : t
      )
    );
  }

  function handleSendMessage() {
    const trimmed = draftText.trim();
    if (!trimmed || !activeThread || !userId) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender_id: userId,
      text: trimmed,
      timestamp: formatTime(),
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.requestId === activeThread.requestId
          ? { ...t, messages: [...t.messages, newMsg] }
          : t
      )
    );
    setDraftText('');

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }

  const filteredThreads = threads.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      t.partnerName.toLowerCase().includes(q) ||
      t.skillName.toLowerCase().includes(q)
    );
  });

  // =========================================================
  // VIEW 1: ACTIVE CHAT CONVERSATION SCREEN
  // =========================================================
  if (activeThread) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {/* Chat Top Bar */}
        <View style={styles.chatHeader}>
  <View style={styles.chatPartnerInfo}>
    <Pressable
      style={styles.iconButton}
      onPress={() => router.push('/messages')}>
      <Ionicons name="arrow-back-outline" size={22} color="#4C1D95" />
    </Pressable>

    <View style={styles.avatarWrap}>
      <Image
        source={{
          uri: getAvatarUri(
            activeThread.partnerName,
            activeThread.partnerAvatar
          ),
        }}
        style={styles.chatHeaderAvatar}
      />
      <View style={styles.onlineDotSmall} />
    </View>

    <View style={styles.partnerTextCol}>
      <Text style={styles.chatPartnerName} numberOfLines={1}>
        {activeThread.partnerName}
      </Text>
      <Text style={styles.chatSkillSub} numberOfLines={1}>
        {activeThread.skillName} · {activeThread.status}
      </Text>
    </View>
  </View>

  <Pressable
    style={styles.videoButton}
    onPress={() => router.push('/session')}>
    <Ionicons name="videocam-outline" size={21} color="#7C3AED" />
  </Pressable>
</View>

        {/* Messages Feed + Input Bar */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.chatScrollContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }>
            {/* Context Pill Banner */}
            <View style={styles.contextBanner}>
              <Ionicons name="sparkles" size={14} color="#7C3AED" />
              <Text style={styles.contextBannerText}>
                Skill Swap: {activeThread.skillName}
              </Text>
            </View>

            {activeThread.messages.map((msg) => {
              const isMine = msg.sender_id === userId;
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.bubbleRow,
                    isMine ? styles.myBubbleRow : styles.theirBubbleRow,
                  ]}>
                  {!isMine && (
                    <Image
                      source={{
                        uri: getAvatarUri(
                          activeThread.partnerName,
                          activeThread.partnerAvatar
                        ),
                      }}
                      style={styles.bubbleAvatar}
                    />
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      isMine ? styles.myBubble : styles.theirBubble,
                    ]}>
                    <Text
                      style={[
                        styles.messageText,
                        isMine ? styles.myMessageText : styles.theirMessageText,
                      ]}>
                      {msg.text}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        isMine ? styles.myMessageTime : styles.theirMessageTime,
                      ]}>
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom Message Input Bar */}
          <View style={styles.composerBar}>
            <TextInput
              style={styles.composerInput}
              placeholder="Write a message..."
              placeholderTextColor="#94A3B8"
              value={draftText}
              onChangeText={setDraftText}
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSendMessage}
              disabled={!draftText.trim()}
              style={[
                styles.sendButton,
                !draftText.trim() && styles.sendButtonDisabled,
              ]}>
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // =========================================================
  // VIEW 2: INBOX CONVERSATIONS LIST
  // =========================================================
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
        <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Pressable style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color="#4C1D95" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Illustrated Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTextCol}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>PEER CHAT</Text>
            </View>
            <Text style={styles.heroTitle}>Coordinate Your Swaps</Text>
            <Text style={styles.heroSubtitle}>
              Message your mentors and learners to agree on session goals and
              schedules.
            </Text>
          </View>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=300&q=80',
            }}
            style={styles.heroImage}
          />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#7C3AED" />
          <TextInput
            style={styles.search}
            placeholder="Search people or skills..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Direct Messages</Text>
          <Text style={styles.sectionCount}>
            {filteredThreads.length}{' '}
            {filteredThreads.length === 1 ? 'chat' : 'chats'}
          </Text>
        </View>

        {/* Conversations List */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#7C3AED"
            style={{ marginTop: 40 }}
          />
        ) : filteredThreads.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIllustrationWrapper}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=400&q=80',
                }}
                style={styles.emptyIllustration}
              />
              <View style={styles.emptyFloatingBadge}>
                <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyText}>
              Request a skill swap on Courses to start chatting with a mentor.
            </Text>
            <Pressable
              style={styles.exploreCta}
              onPress={() => router.push('/explore')}>
              <Text style={styles.exploreCtaText}>Browse Courses</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredThreads.map((item) => {
              const lastMessage = item.messages[item.messages.length - 1];
              return (
                <Pressable
                  key={item.requestId}
                  onPress={() => openThread(item.requestId)}
                  style={styles.threadCard}>
                  <View style={styles.avatarWrap}>
                    <Image
                      source={{
                        uri: getAvatarUri(
                          item.partnerName,
                          item.partnerAvatar
                        ),
                      }}
                      style={styles.threadAvatar}
                    />
                    <View style={styles.onlineDot} />
                  </View>

                  <View style={styles.threadMiddle}>
                    <View style={styles.threadTopRow}>
                      <Text style={styles.threadName} numberOfLines={1}>
                        {item.partnerName}
                      </Text>
                      <Text style={styles.threadTime}>
                        {lastMessage?.timestamp ?? ''}
                      </Text>
                    </View>

                    <View style={styles.skillTagRow}>
                      <View style={styles.skillPill}>
                        <Text style={styles.skillPillText}>
                          {item.skillName}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.lastMessage,
                        item.unreadCount > 0 && styles.lastMessageUnread,
                      ]}
                      numberOfLines={1}>
                      {lastMessage?.text ?? 'Tap to start chatting'}
                    </Text>
                  </View>

                  {item.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Navigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF5FF',
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  iconButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  heroBanner: {
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  heroTextCol: {
    flex: 1,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  heroPillText: {
    color: '#F3E8FF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#EDE9FE',
    fontSize: 12,
    lineHeight: 17,
  },
  heroImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: 20,
  },
  search: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1E1B4B',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
  listContainer: {
    gap: 12,
  },
  threadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  avatarWrap: {
    position: 'relative',
  },
  threadAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  threadMiddle: {
    flex: 1,
  },
  threadTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  threadName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    flex: 1,
    marginRight: 8,
  },
  threadTime: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  skillTagRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  skillPill: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  skillPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  lastMessage: {
    fontSize: 13,
    color: '#6B7280',
  },
  lastMessageUnread: {
    color: '#1E1B4B',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 26,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  emptyIllustrationWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  emptyIllustration: {
    width: 140,
    height: 94,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E9D5FF',
  },
  emptyFloatingBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
    marginBottom: 14,
  },
  exploreCta: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exploreCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Active Chat Screen Styles
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9D5FF',
    gap: 10,
  },
  chatPartnerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  videoButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  chatHeaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E9D5FF',
    backgroundColor: '#7C3AED',
  },
  onlineDotSmall: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  partnerTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  chatPartnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  chatSkillSub: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#7C3AED',
    marginTop: 2,
  },
  chatScrollContent: {
    padding: 16,
    gap: 12,
  },
  contextBanner: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  contextBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B21B6',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  myBubbleRow: {
    justifyContent: 'flex-end',
  },
  theirBubbleRow: {
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  messageBubble: {
    maxWidth: '76%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#1E1B4B',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: '#EDE9FE',
  },
  theirMessageTime: {
    color: '#94A3B8',
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9D5FF',
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 22,
    paddingHorizontal: 16,
    height: 44,
    fontSize: 14,
    color: '#1E1B4B',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});