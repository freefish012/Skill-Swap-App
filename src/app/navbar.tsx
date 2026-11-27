// BasicNavigationBar.tsx (Used on Web & iOS)
import { Entypo, FontAwesome } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function BasicNavigationBar() {
  const router = useRouter();
  const pathname = usePathname();

  // Check current route path (supports both '/' and '/home' for the main index screen)
  const isHome = pathname === '/' || pathname === '/home';
  const isSession = pathname === '/session';
  const isProfile = pathname === '/profile';
  const isMessage = pathname ==='/messages';

  return (
    <View style={styles.bar}>
      <Pressable style={styles.item} onPress={() => router.push('/home')}>
        <Entypo name="home" size={24} color={isHome ? '#7C3AED' : '#9CA3AF'} />
        <Text style={[styles.label, isHome && styles.activeLabel]}>Home</Text>
      </Pressable>

      <Pressable style={styles.item} onPress={() => router.push('/session')}>
        <FontAwesome
          name="calendar"
          size={24}
          color={isSession ? '#7C3AED' : '#9CA3AF'}
        />
        <Text style={[styles.label, isSession && styles.activeLabel]}>
          Session
        </Text>
      </Pressable>

      <Pressable style={styles.item} onPress={() => router.push('/messages')}>
        <MaterialCommunityIcons 
        name="message-processing-outline"
         size={24} 
        color={isMessage ? '#7C3AED' : '#9CA3AF'} />
        <Text style={[styles.label, isMessage && styles.activeLabel]}>
          Messages
        </Text>
      </Pressable>

      <Pressable style={styles.item} onPress={() => router.push('/profile')}>
        <Ionicons
          name="person"
          size={24}
          color={isProfile ? '#7C3AED' : '#9CA3AF'}
        />
        <Text style={[styles.label, isProfile && styles.activeLabel]}>
          Profile
        </Text>
      </Pressable>

      
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E9D5FF',
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  item: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  activeLabel: {
    color: '#7C3AED',
    fontWeight: '700',
  },
});