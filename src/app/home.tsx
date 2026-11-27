import { MaterialCommunityIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
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

interface UserProfile {
  full_name: string;
  coin_balance: number;
  avatar_url?: string | null;
}

// Helper to pick a relevant cover photo based on the skill name
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

// Helper to build a clean avatar URL if avatar_url is NULL in Supabase
function getAvatarUri(name?: string, avatarUrl?: string | null): string {
  if (avatarUrl && avatarUrl.trim().length > 0) return avatarUrl;
  const encoded = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encoded}&background=7C3AED&color=FFFFFF&bold=true`;
}

export default function Index() {
  const { userId } = useAuth();
  const [sessions, setSession] = useState<any[]>([]);
  const router=useRouter()
  const [course, setCourse] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [query, setQuery] = useState('');
  const [select, setSelect] = useState(0);

  const options = [
    ['Manage Post', 'post','/post'],
    ['Wallet', 'wallet-bifold','/wallet'],
    ['Find Course', 'google-classroom','/explore'],
  ] as const;

  useEffect(() => {
    if (!userId) return;

    async function retrieveUser() {
      const { data, error } = await supabase
        .from('users')
        .select('full_name, coin_balance, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to retrieve user:', error.message);
      } else {
        setUserProfile(data);
      }
    }

    async function retrieveAllData() {
      const { data, error } = await supabase
        .from('swap_requests')
        .select(`
          id,
          receiver:users!receiver_id ( full_name, avatar_url ),
          skill:skills!requested_skill_id ( name ),
          sessions!inner ( scheduled_time, status )
        `)
        .eq('requester_id', userId)
        .eq('status', 'ACCEPTED')
        .eq('sessions.status', 'SCHEDULED');

      if (error) {
        console.error('Failed to retrieve sessions:', error.message);
      } else {
        setSession(data || []);
      }
    }

    async function retrieveCourse() {
      const { data, error } = await supabase
        .from('offered_skills')
        .select(
          'id,user:users!user_id(full_name, avatar_url),skill:skills!skill_id(name),proficiency_level,coin_request'
        )
        .eq('type', 'OFFERED');

      if (error) {
        console.error('Failed to retrieve courses:', error.message);
      } else {
        setCourse(data || []);
      }
    }

    retrieveUser();
    retrieveAllData();
    retrieveCourse();
  }, [userId]);

  const filteredCourses = course.filter((item) => {
    const skillName = item.skill?.name?.toLowerCase() ?? '';
    const teacherName = item.user?.full_name?.toLowerCase() ?? '';
    const q = query.toLowerCase().trim();
    return skillName.includes(q) || teacherName.includes(q);
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Top Greeting Header with Profile Photo */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={{
                uri: getAvatarUri(
                  userProfile?.full_name,
                  userProfile?.avatar_url
                ),
              }}
              style={styles.profileAvatar}
            />
            <View>
              <Text style={styles.subtitle}>Welcome back,</Text>
              <Text style={styles.title}>
                {userProfile?.full_name ?? 'Learner'}
              </Text>
            </View>
          </View>

          <Pressable style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color="#4C1D95" />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#7C3AED" />
          <TextInput
            style={styles.search}
            placeholder="Search skills or mentors..."
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

        {/* Purple Visual Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTextCol}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>PEER LEARNING</Text>
            </View>
            <Text style={styles.heroTitle}>Swap Skills, Earn Coins</Text>
            <Text style={styles.heroSubtitle}>
              Teach what you know and unlock new sessions with mentors.
            </Text>
          </View>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=300&q=80',
            }}
            style={styles.heroImage}
          />
        </View>

        {/* Quick Action Tiles */}
        <View style={styles.actionRow}>
          {options.map(([label, iconName,route], index) => {
            const selected = index === select;
            return (
              <Pressable
                key={label}
                onPress={() => {
                  setSelect(index)
                 router.push(route);
                }
                }
                style={[styles.actionCard, selected && styles.selectedActionCard]}>
                <View
                  style={[
                    styles.actionIconCircle,
                    selected && styles.selectedIconCircle,
                  ]}>
                  <MaterialCommunityIcons
                    name={iconName}
                    size={22}
                    color={selected ? '#FFFFFF' : '#7C3AED'}
                  />
                </View>
                <Text
                  style={[
                    styles.actionLabel,
                    selected && styles.selectedActionLabel,
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Recommended Classes Horizontal Carousel with Cover Pictures */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderTitle}>Recommended Classes</Text>
          <Text style={styles.sectionCount}>
            {filteredCourses.length} available
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}>
          {filteredCourses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No matching classes found</Text>
            </View>
          ) : (
            filteredCourses.map((item) => (
              <View key={item.id} style={styles.courseCard}>
                {/* Top Course Cover Picture */}
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
                </View>

                {/* Card Body */}
                <View style={styles.courseBody}>
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {item.skill?.name ?? 'Untitled Skill'}
                  </Text>

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
                    <Text style={styles.courseMentor} numberOfLines={1}>
                      {item.user?.full_name ?? 'Unknown'}
                    </Text>
                  </View>

                  <View style={styles.coinTag}>
                    <MaterialCommunityIcons
                      name="circle-multiple"
                      size={14}
                      color="#FACC15"
                    />
                    <Text style={styles.coinTagText}>
                      {item.coin_request ?? 0} coins
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Bottom Overview Cards: Upcoming Session & Wallet Balance */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.bottomRow}>
          {/* Upcoming Session Card (Soft Lavender) */}
          <Pressable style={styles.eventCard} onPress={()=>router.push('/session')}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="calendar" size={18} color="#6D28D9" />
              <Text style={styles.eventCardHeader}>Next Session</Text>
            </View>

            {sessions.length === 0 ? (
              <Text style={styles.eventEmpty}>No upcoming sessions</Text>
            ) : (
              sessions.map((item) => (
                <View key={item.id} style={styles.sessionItem}>
                  <Text style={styles.eventSkill} numberOfLines={1}>
                    {item.skill?.name}
                  </Text>
                  <View style={styles.sessionMentorRow}>
                    <Image
                      source={{
                        uri: getAvatarUri(
                          item.receiver?.full_name,
                          item.receiver?.avatar_url
                        ),
                      }}
                      style={styles.smallAvatar}
                    />
                    <Text style={styles.eventMeta} numberOfLines={1}>
                      {item.receiver?.full_name}
                    </Text>
                  </View>
                  <Text style={styles.eventTime}>
                    {item.sessions?.[0]?.scheduled_time
                      ? new Date(
                          item.sessions[0].scheduled_time
                        ).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Time TBD'}
                  </Text>
                </View>
              ))
            )}
          </Pressable>

          {/* Wallet Balance Card (Deep Royal Purple with Coin Badge & Watermark) */}
          <Pressable style={styles.coinCard} onPress={()=>router.push('/wallet')}>
            <MaterialCommunityIcons
              name="circle-multiple"
              size={76}
              color="rgba(255, 255, 255, 0.08)"
              style={styles.coinWatermark}
            />

            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons
                name="wallet"
                size={18}
                color="#DDD6FE"
              />
              <Text style={styles.coinCardHeader}>Balance</Text>
            </View>

            <View style={styles.coinBalanceRow}>
              <View style={styles.coinBadge}>
                <MaterialCommunityIcons
                  name="circle-multiple"
                  size={24}
                  color="#FACC15"
                />
              </View>
              <View>
                <Text style={styles.coinAmount}>
                  {userProfile?.coin_balance ?? 0}
                </Text>
                <Text style={styles.coinUnit}>Skill Coins</Text>
              </View>
            </View>
          </Pressable>
        </View>
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
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1B4B',
    marginTop: 1,
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
  heroBanner: {
    marginTop: 18,
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
    width: 84,
    height: 84,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  selectedActionCard: {
    backgroundColor: '#F3E8FF',
    borderColor: '#7C3AED',
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  selectedIconCircle: {
    backgroundColor: '#7C3AED',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B0764',
    textAlign: 'center',
  },
  selectedActionLabel: {
    color: '#6D28D9',
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionCount: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
  },
  carousel: {
    paddingRight: 20,
  },
  courseCard: {
    width: 195,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  coverWrapper: {
    position: 'relative',
    width: '100%',
    height: 100,
  },
  courseCover: {
    width: '100%',
    height: '100%',
  },
  levelBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(76, 29, 149, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  courseBody: {
    padding: 12,
  },
  courseTitle: {
    color: '#1E1B4B',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  mentorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  mentorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  courseMentor: {
    flex: 1,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  coinTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#7C3AED',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  coinTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 12,
  },
  eventCard: {
    flex: 1.4,
    padding: 14,
    minHeight: 140,
    backgroundColor: '#EDE9FE',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  eventCardHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
  },
  sessionItem: {
    marginBottom: 8,
  },
  eventSkill: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  sessionMentorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  smallAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  eventMeta: {
    fontSize: 12,
    color: '#5B21B6',
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
    marginTop: 6,
  },
  eventEmpty: {
    fontSize: 13,
    color: '#5B21B6',
    marginTop: 6,
  },
  coinCard: {
    flex: 1,
    padding: 14,
    minHeight: 140,
    backgroundColor: '#4C1D95',
    borderRadius: 18,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  coinWatermark: {
    position: 'absolute',
    right: -14,
    top: -12,
  },
  coinCardHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DDD6FE',
  },
  coinBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(250, 204, 21, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  coinUnit: {
    fontSize: 12,
    color: '#C4B5FD',
    fontWeight: '500',
  },
});