import { MaterialCommunityIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth_context';
import { supabase } from '../lib/supabase';
import Navigation from './navbar';

interface LecturerUser {
  id: number;
  full_name: string;
  email?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string;
}

interface OfferedCourse {
  id: number;
  skill_id: number;
  proficiency_level: string | null;
  coin_request: number | null;
  description?: string | null;
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

function getAvatarUri(name?: string, avatarUrl?: string | null): string {
  if (avatarUrl && avatarUrl.trim().length > 0) return avatarUrl;
  const encoded = encodeURIComponent(name || 'Lecturer');
  return `https://ui-avatars.com/api/?name=${encoded}&background=7C3AED&color=FFFFFF&bold=true&size=200`;
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

export default function LecturerProfilePage() {
  const { userId: paramLecturerId } = useLocalSearchParams<{ userId: string }>();
  const { userId: currentUserId } = useAuth();
  const router = useRouter();

  const [lecturer, setLecturer] = useState<LecturerUser | null>(null);
  const [courses, setCourses] = useState<OfferedCourse[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [completedSessionsCount, setCompletedSessionsCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'COURSES' | 'REVIEWS'>('COURSES');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!paramLecturerId) return;

    async function loadLecturerProfile() {
      setLoading(true);
      const lecturerId = Number(paramLecturerId);

      const [userRes, coursesRes, reviewsRes, swapsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, email, avatar_url, bio, created_at')
          .eq('id', lecturerId)
          .maybeSingle(),
        supabase
          .from('offered_skills')
          .select(
            'id, skill_id, proficiency_level, coin_request, description, skill:skills!skill_id(name)'
          )
          .eq('user_id', lecturerId)
          .eq('type', 'OFFERED')
          .order('id', { ascending: false }),
        supabase
          .from('reviews')
          .select(
            'id, rating, comment, created_at, reviewer:users!reviewer_id(full_name, avatar_url)'
          )
          .eq('reviewee_id', lecturerId)
          .order('created_at', { ascending: false }),
        supabase
          .from('swap_requests')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', lecturerId)
          .eq('status', 'ACCEPTED'),
      ]);

      if (userRes.error) {
        console.error('Failed to load lecturer profile:', userRes.error.message);
      } else {
        setLecturer((userRes.data as LecturerUser) || null);
      }

      if (!coursesRes.error && coursesRes.data) {
        setCourses(coursesRes.data as unknown as OfferedCourse[]);
      }

      if (!reviewsRes.error && reviewsRes.data) {
        setReviews(reviewsRes.data as unknown as ReviewItem[]);
      }

      if (!swapsRes.error && swapsRes.count !== null) {
        setCompletedSessionsCount(swapsRes.count);
      }

      setLoading(false);
    }

    loadLecturerProfile();
  }, [paramLecturerId]);

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
        ).toFixed(1)
      : 'New';

  const isOwnProfile = lecturer?.id === currentUserId;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Top Navigation Header */}
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
      ) : !lecturer ? (
        <View style={styles.emptyCard}>
          <Ionicons name="person-outline" size={32} color="#7C3AED" />
          <Text style={styles.emptyTitle}>Lecturer not found</Text>
          <Text style={styles.emptyText}>
            Unable to load this mentor&apos;s profile details.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Profile Identity Card (Matches User Profile Layout) */}
          <View style={styles.profileCard}>
            <View style={styles.coverBanner} />

            <View style={styles.avatarContainer}>
              <Image
                source={{
                  uri: getAvatarUri(lecturer.full_name, lecturer.avatar_url),
                }}
                style={styles.avatar}
              />
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />
              </View>
            </View>

            <Text style={styles.lecturerName}>{lecturer.full_name}</Text>

            <View style={styles.rolePill}>
              <Ionicons name="school" size={13} color="#7C3AED" />
              <Text style={styles.rolePillText}>Verified Skill Mentor</Text>
            </View>

            {lecturer.bio ? (
              <Text style={styles.bioText}>{lecturer.bio}</Text>
            ) : (
              <Text style={styles.bioPlaceholder}>
                Sharing practical skills and peer-to-peer coaching on SkillSwap.
              </Text>
            )}

            {/* 3-Column Metrics Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{courses.length}</Text>
                <Text style={styles.statLabel}>Courses</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statBox}>
                <View style={styles.ratingInline}>
                  <Ionicons name="star" size={15} color="#F59E0B" />
                  <Text style={styles.statValue}>{averageRating}</Text>
                </View>
                <Text style={styles.statLabel}>
                  {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                </Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statBox}>
                <Text style={styles.statValue}>{completedSessionsCount}</Text>
                <Text style={styles.statLabel}>Swaps</Text>
              </View>
            </View>

            {/* Primary Action Button */}
            {isOwnProfile ? (
              <Pressable
                style={styles.secondaryActionBtn}
                onPress={() => router.push('/profile')}>
                <Ionicons name="person-circle-outline" size={18} color="#6D28D9" />
                <Text style={styles.secondaryActionText}>
                  View My Personal Profile
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.messageButton}
                onPress={() => router.push('/messages')}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                <Text style={styles.messageButtonText}>
                  Message {lecturer.full_name.split(' ')[0]}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Toggle Tabs: Courses Offered vs Student Reviews */}
          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setActiveTab('COURSES')}
              style={[
                styles.tabButton,
                activeTab === 'COURSES' && styles.activeTabButton,
              ]}>
              <Ionicons
                name="book-outline"
                size={16}
                color={activeTab === 'COURSES' ? '#FFFFFF' : '#4C1D95'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'COURSES' && styles.activeTabText,
                ]}>
                Courses ({courses.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('REVIEWS')}
              style={[
                styles.tabButton,
                activeTab === 'REVIEWS' && styles.activeTabButton,
              ]}>
              <Ionicons
                name="star-outline"
                size={16}
                color={activeTab === 'REVIEWS' ? '#FFFFFF' : '#4C1D95'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'REVIEWS' && styles.activeTabText,
                ]}>
                Reviews ({reviews.length})
              </Text>
            </Pressable>
          </View>

          {/* Tab Content 1: Offered Courses */}
          {activeTab === 'COURSES' ? (
            courses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="school-outline" size={28} color="#7C3AED" />
                <Text style={styles.emptyTitle}>No active courses</Text>
                <Text style={styles.emptyText}>
                  This lecturer hasn&apos;t listed any active classes yet.
                </Text>
              </View>
            ) : (
              <View style={styles.listContainer}>
                {courses.map((course) => (
                  <Pressable
                    key={course.id}
                    style={styles.courseCard}
                    onPress={() =>
                      router.push({
                        pathname: '/detailPost',
                        params: { id: String(course.id) },
                      })
                    }>
                    <Image
                      source={{ uri: getSkillCoverImage(course.skill?.name) }}
                      style={styles.courseThumb}
                    />
                    <View style={styles.courseInfo}>
                      <View style={styles.courseTopRow}>
                        <View style={styles.levelBadge}>
                          <Text style={styles.levelBadgeText}>
                            {course.proficiency_level ?? 'All Levels'}
                          </Text>
                        </View>
                        <View style={styles.coinBadge}>
                          <MaterialCommunityIcons
                            name="circle-multiple"
                            size={12}
                            color="#FACC15"
                          />
                          <Text style={styles.coinBadgeText}>
                            {course.coin_request ?? 0}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.courseTitle} numberOfLines={1}>
                        {course.skill?.name ?? 'Untitled Skill'}
                      </Text>

                      <Text style={styles.courseDesc} numberOfLines={1}>
                        {course.description?.trim() ||
                          'Tap to view full syllabus and request a swap.'}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#7C3AED"
                    />
                  </Pressable>
                ))}
              </View>
            )
          ) : /* Tab Content 2: Student Reviews */
          reviews.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={28}
                color="#7C3AED"
              />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptyText}>
                Student ratings and feedback will appear here after completed
                sessions.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {reviews.map((rev) => (
                <View key={rev.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
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
                            name={star <= rev.rating ? 'star' : 'star-outline'}
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
        </ScrollView>
      )}

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
    paddingBottom: 105,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: 18,
  },
  coverBanner: {
    width: '100%',
    height: 82,
    backgroundColor: '#4C1D95',
  },
  avatarContainer: {
    position: 'relative',
    marginTop: -44,
    marginBottom: 10,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#EDE9FE',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 1,
  },
  lecturerName: {
    fontSize: 21,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 6,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  bioText: {
    fontSize: 13.5,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 22,
    marginBottom: 16,
  },
  bioPlaceholder: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '88%',
    backgroundColor: '#FAF5FF',
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  ratingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E9D5FF',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '88%',
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: 14,
  },
  messageButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '88%',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryActionText: {
    color: '#6D28D9',
    fontSize: 14,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  activeTabButton: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#3B0764',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    gap: 12,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  courseThumb: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#EDE9FE',
  },
  courseInfo: {
    flex: 1,
  },
  courseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  levelBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
  },
  levelBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'capitalize',
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#4C1D95',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
  },
  coinBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  courseTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 3,
  },
  courseDesc: {
    fontSize: 12.5,
    color: '#6B7280',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reviewerName: {
    fontSize: 14,
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
    fontSize: 13.5,
    lineHeight: 19,
    color: '#374151',
  },
  emptyCard: {
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
    marginTop: 8,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
});