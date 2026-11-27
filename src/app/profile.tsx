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
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth_context';
import { supabase } from '../lib/supabase';
import Navigation from './navbar';

interface UserProfile {
  full_name: string;
  email: string;
  bio: string | null;
  coin_balance: number;
  trust_rating: number;
  avatar_url?: string | null;
}

interface UserSkillItem {
  id: number;
  type: 'OFFERED' | 'WANTED';
  proficiency_level: string | null;
  coin_request: number | null;
  skill?: {
    name: string;
  } | null;
}

function getAvatarUri(name?: string, avatarUrl?: string | null): string {
  if (avatarUrl && avatarUrl.trim().length > 0) return avatarUrl;
  const encoded = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encoded}&background=7C3AED&color=FFFFFF&bold=true&size=200`;
}

export default function Profile() {
  const { userId } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [skills, setSkills] = useState<UserSkillItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function retrieveProfileAndSkills() {
      setLoading(true);
      const [profileRes, skillsRes] = await Promise.all([
        supabase
          .from('users')
          .select('full_name, email, bio, coin_balance, trust_rating, avatar_url')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('offered_skills')
          .select(
            'id, type, proficiency_level, coin_request, skill:skills!skill_id(name)'
          )
          .eq('user_id', userId)
          .order('id', { ascending: false }),
      ]);

      if (profileRes.error) {
        console.error('Failed to retrieve profile:', profileRes.error.message);
      } else {
        setProfile(profileRes.data);
      }

      if (skillsRes.error) {
        console.error('Failed to retrieve user skills:', skillsRes.error.message);
      } else {
        setSkills((skillsRes.data as unknown as UserSkillItem[]) || []);
      }

      setLoading(false);
    }

    retrieveProfileAndSkills();
  }, [userId]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  const offeredSkills = skills.filter(
    (s) => s.type?.toUpperCase() === 'OFFERED'
  );
  const wantedSkills = skills.filter(
    (s) => s.type?.toUpperCase() === 'WANTED'
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Centered Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Pressable style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color="#4C1D95" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#7C3AED"
            style={{ marginTop: 40 }}
          />
        ) : !profile ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Profile information not found.</Text>
          </View>
        ) : (
          <>
            {/* Profile Hero Card with Cover Illustration & Ringed Avatar */}
            <View style={styles.profileHeroCard}>
              <View style={styles.coverBanner}>
                <Image
                  source={{
                    uri: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
                  }}
                  style={styles.coverImage}
                />
                <View style={styles.coverOverlay} />
                <View style={styles.memberBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
                  <Text style={styles.memberBadgeText}>Verified Member</Text>
                </View>
              </View>

              <View style={styles.avatarWrapper}>
                <Image
                  source={{
                    uri: getAvatarUri(profile.full_name, profile.avatar_url),
                  }}
                  style={styles.avatarImage}
                />
                <View style={styles.onlineDot} />
              </View>

              <Text style={styles.name}>{profile.full_name}</Text>
              <Text style={styles.email}>{profile.email}</Text>
            </View>

            {/* Stats Row: Deep Purple Skill Coins & Lavender Trust Rating */}
            <View style={styles.statsRow}>
              <View style={styles.coinStatCard}>
                <MaterialCommunityIcons
                  name="circle-multiple"
                  size={68}
                  color="rgba(255, 255, 255, 0.08)"
                  style={styles.cardWatermark}
                />
                <View style={styles.coinIconCircle}>
                  <MaterialCommunityIcons
                    name="circle-multiple"
                    size={22}
                    color="#FACC15"
                  />
                </View>
                <Text style={styles.coinStatValue}>
                  {profile.coin_balance ?? 0}
                </Text>
                <Text style={styles.coinStatLabel}>Skill Coins</Text>
              </View>

              <View style={styles.ratingStatCard}>
                <View style={styles.ratingIconCircle}>
                  <Ionicons name="star" size={22} color="#7C3AED" />
                </View>
                <Text style={styles.ratingStatValue}>
                  {Number(profile.trust_rating ?? 5).toFixed(2)}
                </Text>
                <Text style={styles.ratingStatLabel}>Trust Rating</Text>
              </View>
            </View>

            {/* Illustrated SkillSwap Community Banner */}
            <View style={styles.journeyCard}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=300&q=80',
                }}
                style={styles.journeyImage}
              />
              <View style={styles.journeyTextCol}>
                <Text style={styles.journeyTag}>SKILLSWAP MENTOR</Text>
                <Text style={styles.journeyTitle}>
                  Share Skills & Build Trust
                </Text>
                <Text style={styles.journeySubtitle}>
                  Complete sessions on time to grow your rating and earn coins.
                </Text>
              </View>
            </View>

            {/* Bio Card */}
            <View style={styles.card}>
              <View style={styles.bioHeaderRow}>
                <View style={styles.bioIconCircle}>
                  <Ionicons
                    name="person-circle-outline"
                    size={18}
                    color="#7C3AED"
                  />
                </View>
                <Text style={styles.sectionLabel}>About Me</Text>
              </View>
              <Text style={styles.bioText}>
                {profile.bio && profile.bio.trim().length > 0
                  ? profile.bio
                  : 'No bio added yet.'}
              </Text>
            </View>

            {/* Skills Offered Card */}
            <View style={styles.card}>
              <View style={styles.skillSectionHeader}>
                <View style={styles.bioHeaderRowNoMargin}>
                  <View style={styles.bioIconCircle}>
                    <Ionicons name="school-outline" size={17} color="#7C3AED" />
                  </View>
                  <Text style={styles.sectionLabel}>
                    Skills Offered ({offeredSkills.length})
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.push('/post')}
                  hitSlop={6}>
                  <Text style={styles.manageLink}>Manage</Text>
                </Pressable>
              </View>

              {offeredSkills.length === 0 ? (
                <Text style={styles.emptySkillText}>
                  No offered skills listed yet.
                </Text>
              ) : (
                <View style={styles.skillChipWrap}>
                  {offeredSkills.map((item) => (
                    <View key={item.id} style={styles.offeredSkillChip}>
                      <Text style={styles.offeredSkillName}>
                        {item.skill?.name ?? 'Skill'}
                      </Text>
                      {item.proficiency_level ? (
                        <View style={styles.levelTag}>
                          <Text style={styles.levelTagText}>
                            {item.proficiency_level}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Skills Wanted Card */}
            <View style={styles.card}>
              <View style={styles.skillSectionHeader}>
                <View style={styles.bioHeaderRowNoMargin}>
                  <View style={styles.wantedIconCircle}>
                    <Ionicons
                      name="sparkles-outline"
                      size={17}
                      color="#B45309"
                    />
                  </View>
                  <Text style={styles.wantedSectionLabel}>
                    Skills Wanted ({wantedSkills.length})
                  </Text>
                </View>
              </View>

              {wantedSkills.length === 0 ? (
                <Text style={styles.emptySkillText}>
                  No wanted skills listed yet.
                </Text>
              ) : (
                <View style={styles.skillChipWrap}>
                  {wantedSkills.map((item) => (
                    <View key={item.id} style={styles.wantedSkillChip}>
                      <Ionicons
                        name="bookmark-outline"
                        size={13}
                        color="#B45309"
                      />
                      <Text style={styles.wantedSkillName}>
                        {item.skill?.name ?? 'Skill'}
                      </Text>
                      {item.proficiency_level ? (
                        <Text style={styles.wantedLevelText}>
                          · {item.proficiency_level}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Sign Out Button */}
            <Pressable style={styles.signOutButton} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </>
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
    gap: 16,
  },
  profileHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    overflow: 'hidden',
  },
  coverBanner: {
    width: '100%',
    height: 104,
    position: 'relative',
    backgroundColor: '#7C3AED',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(109, 40, 217, 0.55)',
  },
  memberBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(30, 27, 75, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarWrapper: {
    marginTop: -44,
    position: 'relative',
    marginBottom: 10,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#7C3AED',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: 21,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  email: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coinStatCard: {
    flex: 1,
    backgroundColor: '#4C1D95',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    gap: 4,
  },
  cardWatermark: {
    position: 'absolute',
    right: -12,
    top: -10,
  },
  coinIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(250, 204, 21, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  coinStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DDD6FE',
  },
  ratingStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    gap: 4,
  },
  ratingIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E1B4B',
    marginTop: 4,
  },
  ratingStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  journeyCard: {
    backgroundColor: '#EDE9FE',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  journeyImage: {
    width: 68,
    height: 68,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
  },
  journeyTextCol: {
    flex: 1,
  },
  journeyTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  journeyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 3,
  },
  journeySubtitle: {
    fontSize: 12,
    color: '#5B21B6',
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  bioHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  bioHeaderRowNoMargin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bioIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wantedIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wantedSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skillSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manageLink: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  skillChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  offeredSkillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
  },
  offeredSkillName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  levelTag: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6D28D9',
    textTransform: 'capitalize',
  },
  coinMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#4C1D95',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  coinMiniText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  wantedSkillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
  },
  wantedSkillName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#78350F',
  },
  wantedLevelText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#B45309',
    textTransform: 'capitalize',
  },
  emptySkillText: {
    fontSize: 13.5,
    color: '#6B7280',
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1E1B4B',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
});