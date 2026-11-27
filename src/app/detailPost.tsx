import { MaterialCommunityIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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

interface CourseDetailData {
  id: number;
  user_id: number;
  skill_id: number;
  proficiency_level: string | null;
  coin_request: number | null;
  description?: string | null;
  user?: {
    full_name: string;
    avatar_url?: string | null;
    bio?: string | null;
  } | null;
  skill?: {
    name: string;
  } | null;
}

interface ReviewItem {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: {
    full_name: string;
    avatar_url?: string | null;
  } | null;
}

interface DateChoice {
  key: string;
  dayName: string;
  dayNum: string;
  monthName: string;
  dateObj: Date;
}

const TIME_SLOTS = [
  { label: '09:00 AM', hour: 9, minute: 0 },
  { label: '11:00 AM', hour: 11, minute: 0 },
  { label: '02:00 PM', hour: 14, minute: 0 },
  { label: '04:00 PM', hour: 16, minute: 0 },
  { label: '06:00 PM', hour: 18, minute: 0 },
  { label: '08:00 PM', hour: 20, minute: 0 },
];

function getNext7Days(): DateChoice[] {
  const days: DateChoice[] = [];
  const base = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push({
      key: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString([], { weekday: 'short' }),
      dayNum: String(d.getDate()),
      monthName: d.toLocaleDateString([], { month: 'short' }),
      dateObj: d,
    });
  }
  return days;
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
    return 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80';
  }
  if (
    name.includes('design') ||
    name.includes('ui') ||
    name.includes('ux') ||
    name.includes('art') ||
    name.includes('draw')
  ) {
    return 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80';
  }
  if (
    name.includes('spanish') ||
    name.includes('language') ||
    name.includes('english') ||
    name.includes('french')
  ) {
    return 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80';
  }
  if (
    name.includes('music') ||
    name.includes('guitar') ||
    name.includes('piano')
  ) {
    return 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80';
  }
  return 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80';
}

function getAvatarUri(name?: string, avatarUrl?: string | null): string {
  if (avatarUrl && avatarUrl.trim().length > 0) return avatarUrl;
  const encoded = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encoded}&background=7C3AED&color=FFFFFF&bold=true`;
}

export default function CourseDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<CourseDetailData | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);

  // Date & Time Scheduler Modal State
  const dateChoices = useMemo(() => getNext7Days(), []);
  const [schedulerOpen, setSchedulerOpen] = useState<boolean>(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(
    dateChoices[0]?.key ?? ''
  );
  const [selectedHour, setSelectedHour] = useState<number>(14);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [customTimeInput, setCustomTimeInput] = useState<string>('14:00');

  useEffect(() => {
    if (!id) return;

    async function loadCourseDetails() {
      setLoading(true);
      const courseId = Number(id);

      const { data: courseData, error: courseError } = await supabase
        .from('offered_skills')
        .select(
          'id, user_id, skill_id, description, proficiency_level, coin_request, user:users!user_id(full_name, avatar_url, bio), skill:skills!skill_id(name)'
        )
        .eq('id', courseId)
        .maybeSingle();

      if (courseError || !courseData) {
        console.error('Failed to load course details:', courseError?.message);
        setLoading(false);
        return;
      }

      const typedCourse = courseData as unknown as CourseDetailData;
      setCourse(typedCourse);

      const [reviewsRes, balanceRes] = await Promise.all([
        supabase
          .from('reviews')
          .select(
            'id, rating, comment, created_at, reviewer:users!reviewer_id(full_name, avatar_url)'
          )
          .eq('reviewee_id', typedCourse.user_id)
          .order('created_at', { ascending: false }),
        userId
          ? supabase
              .from('users')
              .select('coin_balance')
              .eq('id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (!reviewsRes.error && reviewsRes.data) {
        setReviews(reviewsRes.data as unknown as ReviewItem[]);
      }

      if (!balanceRes.error && balanceRes.data) {
        setUserBalance(balanceRes.data.coin_balance ?? 0);
      }

      setLoading(false);
    }

    loadCourseDetails();
  }, [id, userId]);

  function openSchedulerModal() {
    if (!userId || !course) return;
    if (course.user_id === userId) {
      const msg = 'You cannot request your own offered skill.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Notice', msg);
      return;
    }
    setSchedulerOpen(true);
  }

  function handleSelectPresetSlot(hour: number, minute: number) {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    setCustomTimeInput(`${hh}:${mm}`);
  }

  function handleCustomTimeChange(text: string) {
    setCustomTimeInput(text);
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
    if (match) {
      setSelectedHour(Number(match[1]));
      setSelectedMinute(Number(match[2]));
    }
  }

  function buildScheduledDate(): Date | null {
    const day = dateChoices.find((d) => d.key === selectedDayKey);
    if (!day) return null;

    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(customTimeInput.trim());
    if (!match) return null;

    const scheduled = new Date(day.dateObj);
    scheduled.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return scheduled;
  }

  async function handleConfirmSwapRequest() {
    if (!userId || !course || sending) return;

    const scheduledDate = buildScheduledDate();
    if (!scheduledDate) {
      const msg = 'Please enter a valid 24-hour time (e.g. 14:30).';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Invalid Time', msg);
      return;
    }

    setSending(true);
    const { error } = await supabase.from('swap_requests').insert({
      requester_id: userId,
      receiver_id: course.user_id,
      requested_skill_id: course.skill_id,
      status: 'PENDING',
      proposed_time: scheduledDate.toISOString(),
    });
    setSending(false);

    if (error) {
      console.error('Failed to send swap request:', error.message);
      const msg = `Could not send swap request: ${error.message}`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } else {
      setSchedulerOpen(false);
      const formattedSlot = scheduledDate.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const msg = `Swap request sent to ${
        course.user?.full_name ?? 'the mentor'
      } for ${formattedSlot}!`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Request Sent', msg);
    }
  }

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
        ).toFixed(1)
      : null;

  const isOwn = course?.user_id === userId;
  const coinsNeeded = course?.coin_request ?? 0;
  const hasEnoughCoins =
    userBalance === null ? true : userBalance >= coinsNeeded;
  const previewDate = buildScheduledDate();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={22} color="#4C1D95" />
        </Pressable>
        <Text style={styles.title}>Courses</Text>
        <Pressable style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color="#4C1D95" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#7C3AED"
          style={{ marginTop: 60 }}
        />
      ) : !course ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Course not found</Text>
          <Text style={styles.emptyText}>
            This listing may have been removed or is unavailable.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* Hero Cover Banner */}
            <View style={styles.heroWrapper}>
              <Image
                source={{ uri: getSkillCoverImage(course.skill?.name) }}
                style={styles.heroImage}
              />
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>
                  {course.proficiency_level ?? 'All Levels'}
                </Text>
              </View>
            </View>

            {/* Title & Coin Requirement Card */}
            <View style={styles.mainCard}>
              <Text style={styles.courseTitle}>
                {course.skill?.name ?? 'Untitled Skill'}
              </Text>

              <View style={styles.coinBanner}>
                <View style={styles.coinLeft}>
                  <View style={styles.coinIconCircle}>
                    <MaterialCommunityIcons
                      name="circle-multiple"
                      size={22}
                      color="#FACC15"
                    />
                  </View>
                  <View>
                    <Text style={styles.coinLabel}>COINS NEEDED</Text>
                    <Text style={styles.coinValue}>
                      {coinsNeeded} Skill Coins
                    </Text>
                  </View>
                </View>

                {userBalance !== null && !isOwn && (
                  <View
                    style={[
                      styles.balancePill,
                      !hasEnoughCoins && styles.lowBalancePill,
                    ]}>
                    <Text
                      style={[
                        styles.balancePillText,
                        !hasEnoughCoins && styles.lowBalanceText,
                      ]}>
                      Your Wallet: {userBalance}
                    </Text>
                  </View>
                )}
              </View>

              {/* Course Description */}
              <Text style={styles.sectionHeading}>About This Course</Text>
              <Text style={styles.descriptionText}>
                {course.description?.trim() ||
                  'No detailed course description provided yet. Reach out via a swap request to coordinate session topics and schedule.'}
              </Text>
            </View>

            {/* Lecturer / Mentor Profile Card */}
            <Pressable
              style={styles.sectionCard}
              onPress={() =>
                router.push({
                  pathname: '/lecturerProfile',
                  params: { userId: String(course.user_id) },
                })
              }>
              <View style={styles.lecturerCardHeader}>
                <Text style={styles.sectionHeading}>Lecturer</Text>
                <View style={styles.viewProfileRow}>
                  <Text style={styles.viewProfileText}>View Profile</Text>
                  <Ionicons name="chevron-forward" size={16} color="#7C3AED" />
                </View>
              </View>
              <View style={styles.lecturerRow}>
                <Image
                  source={{
                    uri: getAvatarUri(
                      course.user?.full_name,
                      course.user?.avatar_url
                    ),
                  }}
                  style={styles.lecturerAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lecturerName}>
                    {course.user?.full_name ?? 'Unknown Mentor'}
                  </Text>
                  <View style={styles.ratingSummaryRow}>
                    <Ionicons name="star" size={15} color="#F59E0B" />
                    <Text style={styles.ratingScore}>
                      {averageRating ?? 'New'}
                    </Text>
                    <Text style={styles.ratingCount}>
                      ({reviews.length}{' '}
                      {reviews.length === 1 ? 'review' : 'reviews'})
                    </Text>
                  </View>
                </View>
              </View>

              {course.user?.bio ? (
                <Text style={styles.lecturerBio}>{course.user.bio}</Text>
              ) : null}
            </Pressable>

            {/* Lecturer Reviews Section */}
            <View style={styles.sectionCard}>
              <View style={styles.reviewsHeader}>
                <Text style={styles.sectionHeading}>Student Reviews</Text>
                {averageRating && (
                  <View style={styles.avgBadge}>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text style={styles.avgBadgeText}>{averageRating} / 5</Text>
                  </View>
                )}
              </View>

              {reviews.length === 0 ? (
                <View style={styles.noReviewsBox}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={24}
                    color="#7C3AED"
                  />
                  <Text style={styles.noReviewsTitle}>No reviews yet</Text>
                  <Text style={styles.noReviewsText}>
                    Be the first student to complete a session and leave
                    feedback for {course.user?.full_name ?? 'this mentor'}.
                  </Text>
                </View>
              ) : (
                <View style={styles.reviewsList}>
                  {reviews.map((rev) => (
                    <View key={rev.id} style={styles.reviewItem}>
                      <View style={styles.reviewTopRow}>
                        <Image
                          source={{
                            uri: getAvatarUri(
                              rev.reviewer?.full_name,
                              rev.reviewer?.avatar_url
                            ),
                          }}
                          style={styles.reviewerAvatar}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewerName}>
                            {rev.reviewer?.full_name ?? 'Student'}
                          </Text>
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons
                                key={star}
                                name={
                                  star <= rev.rating ? 'star' : 'star-outline'
                                }
                                size={13}
                                color="#F59E0B"
                              />
                            ))}
                          </View>
                        </View>
                        <Text style={styles.reviewDate}>
                          {new Date(rev.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>

                      {rev.comment ? (
                        <Text style={styles.reviewComment}>{rev.comment}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Sticky CTA Bar */}
          <View style={styles.bottomBar}>
            <View>
              <Text style={styles.bottomCoinLabel}>Total Required</Text>
              <View style={styles.bottomCoinRow}>
                <MaterialCommunityIcons
                  name="circle-multiple"
                  size={18}
                  color="#F59E0B"
                />
                <Text style={styles.bottomCoinAmount}>{coinsNeeded} Coins</Text>
              </View>
            </View>

            <Pressable
              disabled={isOwn || sending}
              onPress={openSchedulerModal}
              style={[
                styles.ctaButton,
                isOwn && styles.ownCtaButton,
                sending && { opacity: 0.7 },
              ]}>
              <Ionicons
                name={isOwn ? 'checkmark-circle' : 'calendar-outline'}
                size={18}
                color={isOwn ? '#6D28D9' : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.ctaButtonText,
                  isOwn && styles.ownCtaButtonText,
                ]}>
                {isOwn
                  ? 'Your Listing'
                  : sending
                  ? 'Sending...'
                  : 'Request Swap'}
              </Text>
            </Pressable>
          </View>

          {/* Date & Time Scheduler Modal */}
          <Modal
            visible={schedulerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setSchedulerOpen(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Schedule Session</Text>
                    <Text style={styles.modalSubtitle}>
                      Propose a date and time to {course.user?.full_name ?? 'mentor'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSchedulerOpen(false)}
                    style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={20} color="#4C1D95" />
                  </Pressable>
                </View>

                {/* Step 1: Select Day */}
                <Text style={styles.schedulerLabel}>1. Select Preferred Date</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dateScrollRow}>
                  {dateChoices.map((d) => {
                    const active = selectedDayKey === d.key;
                    return (
                      <Pressable
                        key={d.key}
                        onPress={() => setSelectedDayKey(d.key)}
                        style={[
                          styles.datePill,
                          active && styles.datePillActive,
                        ]}>
                        <Text
                          style={[
                            styles.dateDayName,
                            active && styles.dateTextActive,
                          ]}>
                          {d.dayName}
                        </Text>
                        <Text
                          style={[
                            styles.dateDayNum,
                            active && styles.dateTextActive,
                          ]}>
                          {d.dayNum}
                        </Text>
                        <Text
                          style={[
                            styles.dateMonthName,
                            active && styles.dateTextActive,
                          ]}>
                          {d.monthName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Step 2: Select Time Slot */}
                <Text style={styles.schedulerLabel}>2. Select Preferred Time</Text>
                <View style={styles.timeGrid}>
                  {TIME_SLOTS.map((slot) => {
                    const active =
                      selectedHour === slot.hour &&
                      selectedMinute === slot.minute;
                    return (
                      <Pressable
                        key={slot.label}
                        onPress={() =>
                          handleSelectPresetSlot(slot.hour, slot.minute)
                        }
                        style={[
                          styles.timeSlotPill,
                          active && styles.timeSlotPillActive,
                        ]}>
                        <Text
                          style={[
                            styles.timeSlotText,
                            active && styles.timeSlotTextActive,
                          ]}>
                          {slot.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Optional Custom 24h Time Input */}
                <View style={styles.customTimeRow}>
                  <Text style={styles.customTimeLabel}>Or custom time (24h):</Text>
                  <TextInput
                    style={styles.customTimeInput}
                    value={customTimeInput}
                    onChangeText={handleCustomTimeChange}
                    placeholder="14:00"
                    placeholderTextColor="#94A3B8"
                    maxLength={5}
                  />
                </View>

                {/* Selected Slot Summary */}
                <View style={styles.summaryStrip}>
                  <Ionicons name="calendar" size={16} color="#7C3AED" />
                  <Text style={styles.summaryStripText}>
                    {previewDate
                      ? previewDate.toLocaleString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Enter a valid time (HH:MM)'}
                  </Text>
                </View>

                {/* Modal Actions */}
                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalCancelBtn}
                    onPress={() => setSchedulerOpen(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={sending}
                    onPress={handleConfirmSwapRequest}
                    style={[
                      styles.modalConfirmBtn,
                      sending && { opacity: 0.7 },
                    ]}>
                    <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                    <Text style={styles.modalConfirmText}>
                      {sending ? 'Sending...' : 'Send Request'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF5FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    paddingBottom: 110,
    gap: 16,
  },
  heroWrapper: {
    position: 'relative',
    width: '100%',
    height: 185,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#EDE9FE',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  levelBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(76, 29, 149, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  levelBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  courseTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 14,
  },
  coinBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4C1D95',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    gap: 10,
  },
  coinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(250, 204, 21, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DDD6FE',
    letterSpacing: 0.6,
  },
  coinValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balancePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  lowBalancePill: {
    backgroundColor: 'rgba(254, 202, 202, 0.25)',
  },
  balancePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EDE9FE',
  },
  lowBalanceText: {
    color: '#FECACA',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: '#4B5563',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  lecturerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  viewProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewProfileText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  lecturerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  lecturerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#DDD6FE',
  },
  lecturerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 3,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingScore: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  ratingCount: {
    fontSize: 12.5,
    color: '#6B7280',
  },
  lecturerBio: {
    marginTop: 12,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#4B5563',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3E8FF',
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  avgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  avgBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  noReviewsBox: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
  },
  noReviewsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E1B4B',
    marginTop: 6,
    marginBottom: 2,
  },
  noReviewsText: {
    fontSize: 12.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  reviewsList: {
    gap: 12,
  },
  reviewItem: {
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  reviewerName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  reviewComment: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#374151',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9D5FF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomCoinLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  bottomCoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  bottomCoinAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  ownCtaButton: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  ownCtaButtonText: {
    color: '#6D28D9',
  },
  emptyCard: {
    margin: 20,
    padding: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
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
  },
  // Date & Time Scheduler Modal Styles
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
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: '#6B7280',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schedulerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
    marginTop: 8,
    marginBottom: 8,
  },
  dateScrollRow: {
    gap: 8,
    paddingBottom: 4,
  },
  datePill: {
    width: 64,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    alignItems: 'center',
  },
  datePillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  dateDayNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    marginVertical: 2,
  },
  dateMonthName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  dateTextActive: {
    color: '#FFFFFF',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  timeSlotPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  timeSlotText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#3B0764',
  },
  timeSlotTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  customTimeLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  customTimeInput: {
    width: 90,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  summaryStripText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4C1D95',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B21B6',
  },
  modalConfirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});