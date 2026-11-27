import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
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

interface SessionItem {
  id: number;
  scheduled_time: string | null;
  status: string;
  meeting_link: string | null;
}

interface PartnerInfo {
  full_name: string;
  avatar_url?: string | null;
}

interface SwapRequest {
  id: number;
  status: string;
  requester_id: number | string;
  receiver_id: number | string;
  requester?: PartnerInfo | null;
  receiver?: PartnerInfo | null;
  skill?: { name: string } | null;
  sessions?: SessionItem[];
}

interface ReviewRecord {
  id: number;
  session_id: number;
  reviewer_id: number | string;
  rating: number;
  comment: string | null;
}

function getSkillCoverImage(skillName?: string): string {
  const name = (skillName ?? '').toLowerCase();
  if (
    name.includes('code') ||
    name.includes('python') ||
    name.includes('react') ||
    name.includes('web') ||
    name.includes('ios') ||
    name.includes('java')
  ) {
    return 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400&q=80';
  }
  if (
    name.includes('design') ||
    name.includes('ui') ||
    name.includes('ux') ||
    name.includes('art') ||
    name.includes('draw')
  ) {
    return 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=400&q=80';
  }
  if (
    name.includes('spanish') ||
    name.includes('language') ||
    name.includes('english') ||
    name.includes('french')
  ) {
    return 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=400&q=80';
  }
  if (
    name.includes('music') ||
    name.includes('guitar') ||
    name.includes('piano')
  ) {
    return 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=400&q=80';
  }
  return 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=400&q=80';
}

function getAvatarUri(name?: string, avatarUrl?: string | null): string {
  if (avatarUrl && avatarUrl.trim().length > 0) return avatarUrl;
  const encoded = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encoded}&background=7C3AED&color=FFFFFF&bold=true`;
}

export default function SessionPage() {
  const { userId } = useAuth();
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [reviewsBySession, setReviewsBySession] = useState<
    Record<number, ReviewRecord>
  >({});
  const [select, setSelect] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(
    null
  );

  // Review Modal State
  const [reviewTarget, setReviewTarget] = useState<{
    sessionId: number;
    revieweeId: number | string;
    partnerName: string;
    skillName: string;
  } | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const options = [
    ['Upcoming', 'calendar-sharp'],
    ['Past', 'time'],
    ['Request', 'git-pull-request'],
  ] as const;

  useEffect(() => {
    if (!userId) return;

    async function retrieveSessionAndReviews() {
      setLoading(true);
      const [reqRes, revRes] = await Promise.all([
        supabase
          .from('swap_requests')
          .select(`
            id,
            status,
            requester_id,
            receiver_id,
            requester:users!requester_id ( full_name, avatar_url ),
            receiver:users!receiver_id ( full_name, avatar_url ),
            skill:skills!requested_skill_id ( name ),
            sessions ( id, scheduled_time, status, meeting_link )
          `)
          .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`),
        supabase
          .from('reviews')
          .select('id, session_id, reviewer_id, rating, comment')
          .eq('reviewer_id', userId),
      ]);

      if (reqRes.error) {
        console.error('Failed to retrieve sessions:', reqRes.error.message);
      } else {
        setRequests((reqRes.data as unknown as SwapRequest[]) || []);
      }

      if (!revRes.error && revRes.data) {
        const mapped: Record<number, ReviewRecord> = {};
        (revRes.data as ReviewRecord[]).forEach((r) => {
          mapped[r.session_id] = r;
        });
        setReviewsBySession(mapped);
      }

      setLoading(false);
    }

    retrieveSessionAndReviews();
  }, [userId]);

 async function handleRequestDecision(
  item: SwapRequest,
  decision: 'ACCEPTED' | 'DECLINED'
) {
  if (processingRequestId !== null) return;
  setProcessingRequestId(item.id);

  // 1. Update swap_requests status to ACCEPTED or DECLINED
  const { error: reqError } = await supabase
    .from('swap_requests')
    .update({ status: decision })
    .eq('id', item.id);

  if (reqError) {
    console.error('Failed to update swap request:', reqError.message);
    setProcessingRequestId(null);
    const msg = `Could not ${
      decision === 'ACCEPTED' ? 'approve' : 'decline'
    } request: ${reqError.message}`;
    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    return;
  }

  let updatedSessions = item.sessions ?? [];

  // 2. After Approve (ACCEPTED), create a new row in 'sessions' with status 'SCHEDULED'
  if (decision === 'ACCEPTED') {
    const { data: createdSession, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        swap_request_id: item.id,
        status: 'SCHEDULED',
      })
      .select('id, scheduled_time, status, meeting_link')
      .single();

    if (sessionError) {
      console.error('Failed to create session row:', sessionError.message);
      setProcessingRequestId(null);
      const msg = `Request approved, but failed to create session: ${sessionError.message}`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      return;
    }

    if (createdSession) {
      updatedSessions = [createdSession as SessionItem];
    }
  }

  // 3. Update local state so the card moves from Request to Upcoming immediately
  setRequests((prev) =>
    prev.map((req) =>
      req.id === item.id
        ? { ...req, status: decision, sessions: updatedSessions }
        : req
    )
  );
  setProcessingRequestId(null);
}
  async function executeCancel(sessionId: number, requestId: number) {
    setCancellingId(sessionId);

    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ status: 'CANCELLED' })
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Failed to cancel session:', sessionError.message);
      setCancellingId(null);
      if (Platform.OS === 'web') {
        window.alert('Could not cancel the session.');
      } else {
        Alert.alert('Error', 'Could not cancel the session.');
      }
      return;
    }

    await supabase
      .from('swap_requests')
      .update({ status: 'CANCELLED' })
      .eq('id', requestId);

    setRequests((prev) =>
      prev.map((req) =>
        req.id === requestId
          ? {
              ...req,
              status: 'CANCELLED',
              sessions: req.sessions?.map((s) =>
                s.id === sessionId ? { ...s, status: 'CANCELLED' } : s
              ),
            }
          : req
      )
    );
    setCancellingId(null);
  }

  function handleCancelSession(sessionId: number, requestId: number) {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to cancel this upcoming session?'
      );
      if (confirmed) {
        executeCancel(sessionId, requestId);
      }
      return;
    }

    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel this upcoming session?',
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => executeCancel(sessionId, requestId),
        },
      ]
    );
  }

  function openReviewModal(item: SwapRequest) {
    const sessionInfo = item.sessions?.[0];
    if (!sessionInfo || !userId) return;

    const isRequester = String(item.requester_id) === String(userId);
    const partner = isRequester ? item.receiver : item.requester;
    const revieweeId = isRequester ? item.receiver_id : item.requester_id;

    setRating(5);
    setComment('');
    setReviewTarget({
      sessionId: sessionInfo.id,
      revieweeId,
      partnerName: partner?.full_name ?? 'Partner',
      skillName: item.skill?.name ?? 'Skill Session',
    });
  }

  async function handleSubmitReview() {
    if (!reviewTarget || !userId || submittingReview) return;

    setSubmittingReview(true);
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        session_id: reviewTarget.sessionId,
        reviewer_id: userId,
        reviewee_id: reviewTarget.revieweeId,
        rating,
        comment: comment.trim() || null,
      })
      .select()
      .single();

    setSubmittingReview(false);

    if (error) {
      console.error('Failed to submit review:', error.message);
      const msg =
        'Could not submit review. Please check your database policies.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      return;
    }

    if (data) {
      const saved = data as ReviewRecord;
      setReviewsBySession((prev) => ({
        ...prev,
        [saved.session_id]: saved,
      }));
    }

    setReviewTarget(null);
    const successMsg = 'Thank you! Your review has been submitted.';
    Platform.OS === 'web'
      ? window.alert(successMsg)
      : Alert.alert('Review Submitted', successMsg);
  }

  const upcomingCount = requests.filter(
    (item) =>
      item.status === 'ACCEPTED' &&
      item.sessions?.[0]?.status === 'SCHEDULED'
  ).length;

  // Filter records based on active tab index:
  // 0 = Upcoming, 1 = Past, 2 = Request
  const filteredItems = requests.filter((item) => {
    const sessionStatus = item.sessions?.[0]?.status;

    if (select === 0) {
      return item.status === 'ACCEPTED' && sessionStatus === 'SCHEDULED';
    }
    if (select === 1) {
      return sessionStatus === 'COMPLETED';
    }
    if (select === 2) {
      return item.status === 'PENDING';
    }
    return false;
  });

  const quickTags = [
    'Clear explanation',
    'Very patient',
    'Well prepared',
    'Great communication',
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Centered Header with Right Notification Button */}
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
        <Pressable style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color="#4C1D95" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Visual Session Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTextCol}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>LEARNING SCHEDULE</Text>
            </View>
            <Text style={styles.heroTitle}>
              {upcomingCount === 1
                ? '1 Upcoming Swap'
                : `${upcomingCount} Upcoming Swaps`}
            </Text>
            <Text style={styles.heroSubtitle}>
              Join live video rooms, review past classes, or manage requests.
            </Text>
          </View>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=300&q=80',
            }}
            style={styles.heroImage}
          />
        </View>

        {/* Tab Selector */}
        <View style={styles.tabRow}>
          {options.map(([label, icon], index) => {
            const selected = index === select;
            return (
              <Pressable
                key={label}
                onPress={() => setSelect(index)}
                style={[styles.tab, selected && styles.selectedTab]}>
                <Ionicons
                  name={icon}
                  size={18}
                  color={selected ? '#FFFFFF' : '#6B7280'}
                />
                <Text
                  style={[styles.tabLabel, selected && styles.selectedTabLabel]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Session Cards List */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#7C3AED"
            style={{ marginTop: 40 }}
          />
        ) : (
          <View style={styles.listContainer}>
            {filteredItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIllustrationWrapper}>
                  <Image
                    source={{
                      uri: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=400&q=80',
                    }}
                    style={styles.emptyIllustration}
                  />
                  <View style={styles.emptyFloatingBadge}>
                    <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={styles.emptyTitle}>
                  No {options[select][0].toLowerCase()} sessions yet
                </Text>
                <Text style={styles.emptyText}>
                  {select === 0
                    ? 'Book a skill class on Home to schedule your next live session.'
                    : select === 1
                    ? 'Completed skill exchanges will appear here once finished.'
                    : 'Incoming and outgoing swap requests will show up here.'}
                </Text>
              </View>
            ) : (
              filteredItems.map((item) => {
                const sessionInfo = item.sessions?.[0];
                const isRequester =
                  String(item.requester_id) === String(userId);
                const isReceiver =
                  String(item.receiver_id) === String(userId);
                const partner = isRequester ? item.receiver : item.requester;
                const isCancelling =
                  sessionInfo?.id != null && cancellingId === sessionInfo.id;
                const isProcessingRequest = processingRequestId === item.id;
                const existingReview =
                  sessionInfo?.id != null
                    ? reviewsBySession[sessionInfo.id]
                    : undefined;

                return (
                  <View key={item.id} style={styles.card}>
                    {/* Top Row: Skill Thumbnail + Details */}
                    <View style={styles.cardMainRow}>
                      <Image
                        source={{ uri: getSkillCoverImage(item.skill?.name) }}
                        style={styles.skillThumb}
                      />

                      <View style={styles.cardContentCol}>
                        <View style={styles.cardTop}>
                          <Text style={styles.skillTitle} numberOfLines={1}>
                            {item.skill?.name ?? 'Skill Session'}
                          </Text>
                          <View
                            style={[
                              styles.badge,
                              select === 1 && styles.pastBadge,
                              select === 2 && styles.requestBadge,
                            ]}>
                            <Text
                              style={[
                                styles.badgeText,
                                select === 1 && styles.pastBadgeText,
                                select === 2 && styles.requestBadgeText,
                              ]}>
                              {select === 2 ? item.status : sessionInfo?.status}
                            </Text>
                          </View>
                        </View>

                        {/* Partner Avatar & Name */}
                        <View style={styles.partnerRow}>
                          <Image
                            source={{
                              uri: getAvatarUri(
                                partner?.full_name,
                                partner?.avatar_url
                              ),
                            }}
                            style={styles.partnerAvatar}
                          />
                          <Text style={styles.partnerText} numberOfLines={1}>
                            With{' '}
                            <Text style={styles.partnerNameBold}>
                              {partner?.full_name ?? 'Unknown'}
                            </Text>
                          </Text>
                        </View>

                        {/* Scheduled Date & Time */}
                        {sessionInfo?.scheduled_time && (
                          <View style={styles.timeRow}>
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color="#7C3AED"
                            />
                            <Text style={styles.timeText}>
                              {new Date(
                                sessionInfo.scheduled_time
                              ).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Action Buttons on Upcoming Tab */}
                    {select === 0 && (
                      <View style={styles.actionRow}>
                        {sessionInfo?.meeting_link && (
                          <Pressable
                            style={styles.joinButton}
                            onPress={() =>
                              Linking.openURL(sessionInfo.meeting_link!)
                            }>
                            <Ionicons
                              name="videocam"
                              size={16}
                              color="#FFFFFF"
                            />
                            <Text style={styles.joinButtonText}>
                              Join Session
                            </Text>
                          </Pressable>
                        )}

                        {sessionInfo?.id && (
                          <Pressable
                            style={[
                              styles.cancelButton,
                              isCancelling && styles.disabledButton,
                            ]}
                            disabled={isCancelling}
                            onPress={() =>
                              handleCancelSession(sessionInfo.id, item.id)
                            }>
                            <Ionicons
                              name="close-circle-outline"
                              size={16}
                              color="#DC2626"
                            />
                            <Text style={styles.cancelButtonText}>
                              {isCancelling ? 'Cancelling...' : 'Cancel'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}

                    {/* Review Action on Past Tab */}
                    {select === 1 && sessionInfo?.id && (
                      <View style={styles.actionRow}>
                        {existingReview ? (
                          <View style={styles.reviewedBox}>
                            <View style={styles.reviewedHeader}>
                              <View style={styles.reviewedStars}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Ionicons
                                    key={star}
                                    name={
                                      star <= existingReview.rating
                                        ? 'star'
                                        : 'star-outline'
                                    }
                                    size={14}
                                    color="#F59E0B"
                                  />
                                ))}
                              </View>
                              <Text style={styles.reviewedLabel}>
                                Reviewed ({existingReview.rating}/5)
                              </Text>
                            </View>
                            {existingReview.comment ? (
                              <Text
                                style={styles.reviewedComment}
                                numberOfLines={2}>
                                “{existingReview.comment}”
                              </Text>
                            ) : null}
                          </View>
                        ) : (
                          <Pressable
                            style={styles.reviewButton}
                            onPress={() => openReviewModal(item)}>
                            <Ionicons name="star" size={16} color="#FFFFFF" />
                            <Text style={styles.reviewButtonText}>
                              Leave a Review
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}

                    {/* Approve / Decline Actions on Request Tab */}
                    {select === 2 && item.status === 'PENDING' && (
                      <View style={styles.actionRow}>
                        {isReceiver ? (
                          <>
                            <Pressable
                              style={[
                                styles.approveButton,
                                isProcessingRequest && styles.disabledButton,
                              ]}
                              disabled={isProcessingRequest}
                              onPress={() =>
                                handleRequestDecision(item, 'ACCEPTED')
                              }>
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={16}
                                color="#FFFFFF"
                              />
                              <Text style={styles.approveButtonText}>
                                {isProcessingRequest
                                  ? 'Updating...'
                                  : 'Approve'}
                              </Text>
                            </Pressable>

                            <Pressable
                              style={[
                                styles.cancelButton,
                                isProcessingRequest && styles.disabledButton,
                              ]}
                              disabled={isProcessingRequest}
                              onPress={() =>
                                handleRequestDecision(item, 'DECLINED')
                              }>
                              <Ionicons
                                name="close-circle-outline"
                                size={16}
                                color="#DC2626"
                              />
                              <Text style={styles.cancelButtonText}>
                                Decline
                              </Text>
                            </Pressable>
                          </>
                        ) : (
                          <View style={styles.awaitingBox}>
                            <Ionicons
                              name="hourglass-outline"
                              size={15}
                              color="#B45309"
                            />
                            <Text style={styles.awaitingText}>
                              Waiting for {partner?.full_name ?? 'partner'} to
                              respond
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Review Modal */}
      <Modal
        visible={reviewTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate Your Session</Text>
              <Pressable
                onPress={() => setReviewTarget(null)}
                style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#4C1D95" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              How was your{' '}
              <Text style={{ fontWeight: '700', color: '#1E1B4B' }}>
                {reviewTarget?.skillName}
              </Text>{' '}
              session with{' '}
              <Text style={{ fontWeight: '700', color: '#1E1B4B' }}>
                {reviewTarget?.partnerName}
              </Text>
              ?
            </Text>

            {/* Star Picker */}
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starTap}>
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={34}
                    color={star <= rating ? '#F59E0B' : '#CBD5E1'}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={styles.ratingCaption}>
              {rating === 5
                ? 'Excellent!'
                : rating === 4
                ? 'Very Good'
                : rating === 3
                ? 'Good'
                : rating === 2
                ? 'Fair'
                : 'Needs Improvement'}
            </Text>

            {/* Quick Feedback Chips */}
            <View style={styles.quickTagRow}>
              {quickTags.map((tag) => {
                const active = comment.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() =>
                      setComment((prev) =>
                        prev.includes(tag)
                          ? prev
                          : prev.trim()
                          ? `${prev.trim()}. ${tag}`
                          : tag
                      )
                    }
                    style={[
                      styles.quickTagChip,
                      active && styles.quickTagChipActive,
                    ]}>
                    <Text
                      style={[
                        styles.quickTagText,
                        active && styles.quickTagTextActive,
                      ]}>
                      + {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Comment Input */}
            <TextInput
              style={styles.commentInput}
              placeholder="Share feedback about this session (optional)..."
              placeholderTextColor="#94A3B8"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Submit & Cancel Buttons */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setReviewTarget(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={submittingReview}
                style={[
                  styles.modalSubmitBtn,
                  submittingReview && styles.disabledButton,
                ]}
                onPress={handleSubmitReview}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
    width: 82,
    height: 82,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  selectedTab: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B0764',
  },
  selectedTabLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  skillThumb: {
    width: 74,
    height: 74,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
  },
  cardContentCol: {
    flex: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  skillTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    flex: 1,
    marginRight: 6,
  },
  badge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  pastBadge: {
    backgroundColor: '#F1F5F9',
  },
  pastBadgeText: {
    color: '#475569',
  },
  requestBadge: {
    backgroundColor: '#FEF3C7',
  },
  requestBadgeText: {
    color: '#B45309',
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  partnerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  partnerText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  partnerNameBold: {
    fontWeight: '600',
    color: '#1E1B4B',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3E8FF',
  },
  joinButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 10,
    borderRadius: 12,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 12,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 13,
  },
  awaitingBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 9,
    borderRadius: 12,
  },
  awaitingText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#B45309',
  },
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 10,
    borderRadius: 12,
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  reviewedBox: {
    flex: 1,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 12,
    padding: 10,
  },
  reviewedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewedStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B21B6',
  },
  reviewedComment: {
    marginTop: 5,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#4B5563',
  },
  emptyCard: {
    padding: 24,
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
    height: 96,
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
    marginBottom: 6,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 13.5,
    color: '#6B7280',
    lineHeight: 19,
    marginBottom: 16,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 6,
  },
  starTap: {
    padding: 4,
  },
  ratingCaption: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 14,
  },
  quickTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  quickTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  quickTagChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  quickTagText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#5B21B6',
  },
  quickTagTextActive: {
    color: '#4C1D95',
    fontWeight: '700',
  },
  commentInput: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 14,
    padding: 12,
    minHeight: 84,
    fontSize: 14,
    color: '#1E1B4B',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B21B6',
  },
  modalSubmitBtn: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});