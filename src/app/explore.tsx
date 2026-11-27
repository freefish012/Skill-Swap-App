import { MaterialCommunityIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
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

interface CourseItem {
  id: number;
  user_id: number;
  skill_id: number;
  proficiency_level: string | null;
  coin_request: number | null;
  description?: string | null;
  user?: {
    full_name: string;
    avatar_url?: string | null;
  } | null;
  skill?: {
    name: string;
    description?: string | null;
  } | null;
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
    return 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=500&q=80';
  }
  if (
    name.includes('design') ||
    name.includes('ui') ||
    name.includes('ux') ||
    name.includes('art') ||
    name.includes('draw')
  ) {
    return 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=500&q=80';
  }
  if (
    name.includes('spanish') ||
    name.includes('language') ||
    name.includes('english') ||
    name.includes('french')
  ) {
    return 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=500&q=80';
  }
  if (
    name.includes('music') ||
    name.includes('guitar') ||
    name.includes('piano')
  ) {
    return 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=500&q=80';
  }
  return 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=500&q=80';
}

function getAvatarUri(name?: string, avatarUrl?: string | null): string {
  if (avatarUrl && avatarUrl.trim().length > 0) return avatarUrl;
  const encoded = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encoded}&background=7C3AED&color=FFFFFF&bold=true`;
}

export default function ExplorePage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  const levels = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  useEffect(() => {
    async function retrieveCourse() {
      setLoading(true);
      const { data, error } = await supabase
        .from('offered_skills')
        .select(
          'id, user_id, skill_id, description, user:users!user_id(full_name, avatar_url), skill:skills!skill_id(name), proficiency_level, coin_request'
        )
        .eq('type', 'OFFERED');

      if (error) {
        console.error('Failed to retrieve courses:', error.message);
      } else {
        setCourses((data as unknown as CourseItem[]) || []);
      }
      setLoading(false);
    }

    retrieveCourse();
  }, []);

  function toggleExpand(id: number) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleLearnMore(item: CourseItem) {
    router.push({
      pathname: '/detailPost',
      params: { id: String(item.id) },
    });
  }

  const filteredCourses = courses.filter((item) => {
    const skillName = item.skill?.name?.toLowerCase() ?? '';
    const mentorName = item.user?.full_name?.toLowerCase() ?? '';
    const descText = (
      item.description ??
      item.skill?.description ??
      ''
    ).toLowerCase();
    const q = query.toLowerCase().trim();
    const matchesSearch =
      skillName.includes(q) || mentorName.includes(q) || descText.includes(q);

    const matchesLevel =
      selectedLevel === 'All' ||
      (item.proficiency_level ?? '').toLowerCase() ===
        selectedLevel.toLowerCase();

    return matchesSearch && matchesLevel;
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Top Header with Back & Notification Buttons */}
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={22} color="#4C1D95" />
        </Pressable>
        <Text style={styles.title}>Courses</Text>
        <Pressable style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color="#4C1D95" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#7C3AED" />
          <TextInput
            style={styles.search}
            placeholder="Search courses, topics, or mentors..."
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        {/* Horizontal Level Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          {levels.map((level) => {
            const active = selectedLevel === level;
            return (
              <Pressable
                key={level}
                onPress={() => setSelectedLevel(level)}
                style={[styles.filterChip, active && styles.activeFilterChip]}>
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.activeFilterChipText,
                  ]}>
                  {level}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Results Count */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Skill Classes</Text>
          <Text style={styles.sectionCount}>
            {filteredCourses.length}{' '}
            {filteredCourses.length === 1 ? 'course' : 'courses'}
          </Text>
        </View>

        {/* Course Cards List */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#7C3AED"
            style={{ marginTop: 40 }}
          />
        ) : filteredCourses.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="school-outline" size={28} color="#7C3AED" />
            </View>
            <Text style={styles.emptyTitle}>No courses found</Text>
            <Text style={styles.emptyText}>
              Try clearing your search or switching the proficiency filter.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredCourses.map((item) => {
              const isOwn = item.user_id === userId;
              const courseDescription =
                item.description?.trim() ||
                item.skill?.description?.trim() ||
                'No course description provided yet.';
              const isExpanded = !!expandedIds[item.id];
              const isLongDescription = courseDescription.length > 45;

              return (
                <View key={item.id} style={styles.courseCard}>
                  {/* Top Cover Image + Badges */}
                  <View style={styles.coverWrapper}>
                    <Image
                      source={{ uri: getSkillCoverImage(item.skill?.name) }}
                      style={styles.courseCover}
                    />
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelText}>
                        {item.proficiency_level ?? 'All Levels'}
                      </Text>
                    </View>
                    <View style={styles.coinOverlayBadge}>
                      <MaterialCommunityIcons
                        name="circle-multiple"
                        size={14}
                        color="#FACC15"
                      />
                      <Text style={styles.coinOverlayText}>
                        {item.coin_request ?? 0} Coins
                      </Text>
                    </View>
                  </View>

                  {/* Card Content */}
                  <View style={styles.cardBody}>
                    <Text style={styles.courseTitle}>
                      {item.skill?.name ?? 'Untitled Skill'}
                    </Text>

                    {/* Single-Line Course Description with Read More Toggle */}
                    <View style={styles.descriptionBox}>
                      <Text
                        style={styles.courseDescription}
                        numberOfLines={isExpanded ? undefined : 1}
                        ellipsizeMode="tail">
                        {courseDescription}
                      </Text>
                      {isLongDescription && (
                        <Pressable
                          onPress={() => toggleExpand(item.id)}
                          hitSlop={6}>
                          <Text style={styles.readMoreText}>
                            {isExpanded ? 'Show less' : 'Read more'}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    <View style={styles.cardFooterRow}>
                      <View style={styles.mentorRow}>
                        <Image
                          source={{
                            uri: getAvatarUri(
                              item.user?.full_name,
                              item.user?.avatar_url
                            ),
                          }}
                          style={styles.mentorAvatar}
                        />
                        <View>
                          <Text style={styles.mentorLabel}>Mentor</Text>
                          <Text style={styles.mentorName}>
                            {item.user?.full_name ?? 'Unknown'}
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={() => handleLearnMore(item)}
                        style={[
                          styles.learnMoreButton,
                          isOwn && styles.ownCourseButton,
                        ]}>
                        <Text
                          style={[
                            styles.learnMoreButtonText,
                            isOwn && styles.ownCourseButtonText,
                          ]}>
                          Learn More
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={15}
                          color={isOwn ? '#6D28D9' : '#FFFFFF'}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
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
    paddingBottom: 100,
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
  },
  search: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1E1B4B',
  },
  filterRow: {
    gap: 8,
    paddingVertical: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  activeFilterChip: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B0764',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
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
    gap: 16,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  coverWrapper: {
    position: 'relative',
    width: '100%',
    height: 130,
    backgroundColor: '#EDE9FE',
  },
  courseCover: {
    width: '100%',
    height: '100%',
  },
  levelBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(76, 29, 149, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  coinOverlayBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(30, 27, 75, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  coinOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardBody: {
    padding: 16,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 6,
  },
  descriptionBox: {
    marginBottom: 14,
  },
  courseDescription: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#4B5563',
  },
  readMoreText: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3E8FF',
  },
  mentorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  mentorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
  },
  mentorLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  mentorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
  },
  learnMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  ownCourseButton: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  ownCourseButtonText: {
    color: '#6D28D9',
  },
  emptyCard: {
    padding: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
});