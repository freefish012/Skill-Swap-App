import { MaterialCommunityIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
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

interface UserPost {
  id: number;
  user_id: number;
  skill_id: number;
  type: 'OFFERED';
  proficiency_level: string | null;
  coin_request: number | null;
  description?: string | null;
  created_at?: string;
  skill?: {
    name: string;
  } | null;
}

interface SkillOption {
  id: number;
  name: string;
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

export default function ManagePostPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SkillOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Add Post Modal State
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [skillNameInput, setSkillNameInput] = useState<string>('');
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [proficiencyLevel, setProficiencyLevel] = useState<string>('Beginner');
  const [coinRequest, setCoinRequest] = useState<string>('10');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

  useEffect(() => {
    if (!userId) return;

    async function retrieveData() {
      setLoading(true);
      const [postsRes, skillsRes] = await Promise.all([
        supabase
          .from('offered_skills')
          .select(
            'id, user_id, skill_id, type, proficiency_level, coin_request, description, created_at, skill:skills!skill_id(name)'
          )
          .eq('user_id', userId)
          .eq('type', 'OFFERED')
          .order('id', { ascending: false }),
        supabase
          .from('skills')
          .select('id, name')
          .order('name', { ascending: true }),
      ]);

      if (postsRes.error) {
        console.error('Failed to retrieve user posts:', postsRes.error.message);
      } else {
        setPosts((postsRes.data as unknown as UserPost[]) || []);
      }

      if (!skillsRes.error && skillsRes.data) {
        setAvailableSkills(skillsRes.data as SkillOption[]);
      }

      setLoading(false);
    }

    retrieveData();
  }, [userId]);

  function openAddModal() {
    setSkillNameInput('');
    setSelectedSkillId(null);
    setProficiencyLevel('Beginner');
    setCoinRequest('10');
    setDescription('');
    setModalVisible(true);
  }

  function handleSelectSkillChip(skill: SkillOption) {
    setSelectedSkillId(skill.id);
    setSkillNameInput(skill.name);
  }

  function handleSkillTextChange(text: string) {
    setSkillNameInput(text);
    const match = availableSkills.find(
      (s) => s.name.toLowerCase() === text.trim().toLowerCase()
    );
    setSelectedSkillId(match ? match.id : null);
  }

  async function handleCreatePost() {
    if (!userId || submitting) return;

    const trimmedSkill = skillNameInput.trim();
    if (!trimmedSkill) {
      const msg = 'Please enter or select a skill name.';
      Platform.OS === 'web'
        ? window.alert(msg)
        : Alert.alert('Missing Skill', msg);
      return;
    }

    const parsedCoins = Number(coinRequest);
    if (Number.isNaN(parsedCoins) || parsedCoins < 0) {
      const msg = 'Please enter a valid number of coins (0 or more).';
      Platform.OS === 'web'
        ? window.alert(msg)
        : Alert.alert('Invalid Coins', msg);
      return;
    }

    setSubmitting(true);

    try {
      let finalSkillId = selectedSkillId;
      let finalSkillName = trimmedSkill;

      // Match existing skill or insert new skill into `skills`
      if (!finalSkillId) {
        const { data: existingSkill } = await supabase
          .from('skills')
          .select('id, name')
          .ilike('name', trimmedSkill)
          .maybeSingle();

        if (existingSkill) {
          finalSkillId = existingSkill.id;
          finalSkillName = existingSkill.name;
        } else {
          const { data: newSkill, error: skillError } = await supabase
            .from('skills')
            .insert({ name: trimmedSkill })
            .select('id, name')
            .single();

          if (skillError || !newSkill) {
            throw new Error(
              skillError?.message || 'Could not create the new skill.'
            );
          }

          finalSkillId = newSkill.id;
          finalSkillName = newSkill.name;
          setAvailableSkills((prev) =>
            [...prev, newSkill].sort((a, b) => a.name.localeCompare(b.name))
          );
        }
      }

      const { data: createdPost, error: postError } = await supabase
        .from('offered_skills')
        .insert({
          user_id: userId,
          skill_id: finalSkillId,
          type: 'OFFERED',
          proficiency_level: proficiencyLevel,
          coin_request: parsedCoins,
          description: description.trim() || null,
        })
        .select(
          'id, user_id, skill_id, type, proficiency_level, coin_request, description, created_at'
        )
        .single();

      if (postError || !createdPost) {
        throw new Error(postError?.message || 'Could not publish your post.');
      }

      const newPostEntry: UserPost = {
        ...(createdPost as Omit<UserPost, 'skill'>),
        skill: { name: finalSkillName },
      };

      setPosts((prev) => [newPostEntry, ...prev]);
      setModalVisible(false);
    } catch (err: any) {
      console.error('Failed to add post:', err.message);
      const msg = err.message || 'Could not add post. Please try again.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function executeDelete(postId: number) {
    setDeletingId(postId);
    const { error } = await supabase
      .from('offered_skills')
      .delete()
      .eq('id', postId);

    setDeletingId(null);

    if (error) {
      console.error('Failed to delete post:', error.message);
      const msg = 'Could not delete this post. Check your database policies.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  }

  function handleDeletePost(postId: number, skillName?: string) {
    const title = skillName ?? 'this post';
    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove "${title}"?`)) {
        executeDelete(postId);
      }
      return;
    }

    Alert.alert('Delete Post', `Are you sure you want to remove "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => executeDelete(postId),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={22} color="#4C1D95" />
        </Pressable>
        <Text style={styles.title}>My Posts</Text>
        <Pressable style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color="#4C1D95" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Illustrated Hero Summary Card */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTextCol}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>YOUR SKILL BOARD</Text>
            </View>
            <Text style={styles.heroTitle}>
              {posts.length}{' '}
              {posts.length === 1 ? 'Skill Offered' : 'Skills Offered'}
            </Text>
            <Text style={styles.heroSubtitle}>
              Manage the skills you teach and share with learners.
            </Text>
          </View>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=300&q=80',
            }}
            style={styles.heroImage}
          />
        </View>

     

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Offered Skills</Text>
          <Text style={styles.sectionCount}>
            {posts.length} {posts.length === 1 ? 'listing' : 'listings'}
          </Text>
        </View>

        {/* Posts List */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#7C3AED"
            style={{ marginTop: 40 }}
          />
        ) : posts.length === 0 ? (
          <Pressable style={styles.emptyCard} onPress={openAddModal}>
            <View style={styles.emptyIllustrationWrapper}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80',
                }}
                style={styles.emptyIllustration}
              />
              <View style={styles.emptyFloatingBadge}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>No offered skills yet</Text>
            <Text style={styles.emptyText}>
              Tap &quot;Add New Skill Post&quot; above to publish your first
              offered skill.
            </Text>
          </Pressable>
        ) : (
          <View style={styles.listContainer}>
            {posts.map((item) => {
              const isDeleting = deletingId === item.id;

              return (
                <View key={item.id} style={styles.postCard}>
                  <View style={styles.cardMainRow}>
                    <Image
                      source={{ uri: getSkillCoverImage(item.skill?.name) }}
                      style={styles.skillThumb}
                    />

                    <View style={styles.cardContentCol}>
                      <View style={styles.cardTopRow}>
                        <View style={styles.offeredBadge}>
                          <Text style={styles.offeredBadgeText}>OFFERED</Text>
                        </View>

                        <View style={styles.coinPill}>
                          <MaterialCommunityIcons
                            name="circle-multiple"
                            size={13}
                            color="#FACC15"
                          />
                          <Text style={styles.coinPillText}>
                            {item.coin_request ?? 0} coins
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.skillTitle} numberOfLines={1}>
                        {item.skill?.name ?? 'Untitled Skill'}
                      </Text>

                      <View style={styles.metaRow}>
                        <Ionicons
                          name="ribbon-outline"
                          size={14}
                          color="#7C3AED"
                        />
                        <Text style={styles.levelText}>
                          {item.proficiency_level ?? 'All Levels'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {item.description ? (
                    <Text style={styles.postDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Bottom Action Row */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.dateText}>
                      {item.created_at
                        ? `Posted ${new Date(item.created_at).toLocaleDateString(
                            [],
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }
                          )}`
                        : 'Active listing'}
                    </Text>

                    <Pressable
                      disabled={isDeleting}
                      onPress={() =>
                        handleDeletePost(item.id, item.skill?.name)
                      }
                      style={[
                        styles.deleteButton,
                        isDeleting && styles.disabledButton,
                      ]}>
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color="#DC2626"
                      />
                      <Text style={styles.deleteButtonText}>
                        {isDeleting ? 'Removing...' : 'Delete'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
        {/* Centered Add Post Button */}
        <View style={styles.centerAddWrapper}>
          <Pressable style={styles.centerAddButton} onPress={openAddModal}>
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.centerAddButtonText}>Add New Skill Post</Text>
          </Pressable>
        </View>
          </View>
        )}
      </ScrollView>

      {/* Add New Post Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Skill Post</Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#4C1D95" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Skill Name */}
              <Text style={styles.fieldLabel}>Skill Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. React Native, UI/UX Design, Guitar..."
                placeholderTextColor="#94A3B8"
                value={skillNameInput}
                onChangeText={handleSkillTextChange}
              />

              {/* Existing Skills Quick-Select */}
              {availableSkills.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}>
                  {availableSkills.slice(0, 12).map((skill) => {
                    const active = selectedSkillId === skill.id;
                    return (
                      <Pressable
                        key={skill.id}
                        onPress={() => handleSelectSkillChip(skill)}
                        style={[
                          styles.skillChip,
                          active && styles.skillChipActive,
                        ]}>
                        <Text
                          style={[
                            styles.skillChipText,
                            active && styles.skillChipTextActive,
                          ]}>
                          {skill.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Proficiency Level */}
              <Text style={styles.fieldLabel}>Proficiency Level</Text>
              <View style={styles.levelGrid}>
                {levels.map((lvl) => {
                  const active = proficiencyLevel === lvl;
                  return (
                    <Pressable
                      key={lvl}
                      onPress={() => setProficiencyLevel(lvl)}
                      style={[
                        styles.levelPill,
                        active && styles.levelPillActive,
                      ]}>
                      <Text
                        style={[
                          styles.levelPillText,
                          active && styles.levelPillTextActive,
                        ]}>
                        {lvl}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Coins Requested */}
              <Text style={styles.fieldLabel}>Coins Needed per Session</Text>
              <View style={styles.coinInputWrapper}>
                <MaterialCommunityIcons
                  name="circle-multiple"
                  size={20}
                  color="#F59E0B"
                />
                <TextInput
                  style={styles.coinInput}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#94A3B8"
                  value={coinRequest}
                  onChangeText={setCoinRequest}
                />
                <Text style={styles.coinSuffix}>coins</Text>
              </View>

              {/* Course Description */}
              <Text style={styles.fieldLabel}>Course Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe what learners will cover in your session..."
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </ScrollView>

            {/* Modal Footer Buttons */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={submitting}
                onPress={handleCreatePost}
                style={[
                  styles.modalSubmitBtn,
                  submitting && styles.disabledButton,
                ]}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>
                  {submitting ? 'Publishing...' : 'Publish Post'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  heroBanner: {
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
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
  centerAddWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  centerAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 16,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  centerAddButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
    gap: 14,
  },
  postCard: {
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
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  offeredBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  offeredBadgeText: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: '800',
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4C1D95',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  coinPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  skillTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  levelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  postDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3E8FF',
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
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
    maxWidth: 440,
    maxHeight: '88%',
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
    marginBottom: 14,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E1B4B',
  },
  textArea: {
    minHeight: 80,
    marginBottom: 6,
  },
  chipScroll: {
    gap: 6,
    paddingTop: 8,
    paddingBottom: 2,
  },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  skillChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5B21B6',
  },
  skillChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  levelPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  levelPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#3B0764',
  },
  levelPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  coinInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  coinInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  coinSuffix: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3E8FF',
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