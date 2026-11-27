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

interface WalletTransaction {
  id: number;
  amount: number;
  transaction_type: string;
  status: string;
  description: string | null;
  created_at?: string;
}

export default function WalletPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'CREDIT' | 'DEBIT'>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) return;

    async function retrieveWalletData() {
      setLoading(true);

      const [userRes, txRes] = await Promise.all([
        supabase
          .from('users')
          .select('coin_balance')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('wallet_transactions')
          .select('id, amount, transaction_type, status, description, created_at')
          .eq('user_id', userId)
          .order('id', { ascending: false }),
      ]);

      if (userRes.error) {
        console.error('Failed to retrieve coin balance:', userRes.error.message);
      } else if (userRes.data) {
        setCoinBalance(userRes.data.coin_balance ?? 0);
      }

      if (txRes.error) {
        console.error('Failed to retrieve transactions:', txRes.error.message);
      } else {
        setTransactions((txRes.data as WalletTransaction[]) || []);
      }

      setLoading(false);
    }

    retrieveWalletData();
  }, [userId]);

  const isCreditType = (type?: string) => {
    const upper = (type ?? '').toUpperCase();
    return (
      upper.includes('EARN') ||
      upper.includes('CREDIT') ||
      upper.includes('DEPOSIT') ||
      upper.includes('REFUND') ||
      upper.includes('BONUS')
    );
  };

  const pendingTransactions = transactions.filter(
    (tx) => tx.status?.toUpperCase() === 'PENDING'
  );

  const pendingCoinsTotal = pendingTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amount ?? 0),
    0
  );

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return tx.status?.toUpperCase() === 'PENDING';
    const credit = isCreditType(tx.transaction_type) || tx.amount > 0;
    return filter === 'CREDIT' ? credit : !credit;
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={22} color="#4C1D95" />
        </Pressable>
        <Text style={styles.title}>Wallet</Text>
        <Pressable style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color="#4C1D95" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Deep Royal Purple Balance Hero Card */}
        <View style={styles.balanceCard}>
          <MaterialCommunityIcons
            name="circle-multiple"
            size={110}
            color="rgba(255, 255, 255, 0.07)"
            style={styles.balanceWatermark}
          />

          <View style={styles.balanceTopRow}>
            <View style={styles.walletLabelPill}>
              <MaterialCommunityIcons
                name="wallet"
                size={15}
                color="#FDE047"
              />
              <Text style={styles.walletLabelText}>AVAILABLE BALANCE</Text>
            </View>
          </View>

          <View style={styles.balanceMainRow}>
            <View style={styles.goldCoinEmblem}>
              <MaterialCommunityIcons
                name="circle-multiple"
                size={30}
                color="#FACC15"
              />
            </View>
            <View>
              <Text style={styles.balanceValue}>{coinBalance}</Text>
              <Text style={styles.balanceUnit}>Skill Coins</Text>
            </View>
          </View>

          <View style={styles.balanceFooter}>
            <Ionicons name="sparkles" size={14} color="#DDD6FE" />
            <Text style={styles.balanceHint}>
              Teach sessions to earn more coins, or spend them to learn.
            </Text>
          </View>
        </View>

        {/* Pending Coins Section */}
        <View style={styles.pendingSectionCard}>
          <View style={styles.pendingHeaderRow}>
            <View style={styles.pendingTitleGroup}>
              <View style={styles.pendingIconCircle}>
                <Ionicons name="time-outline" size={18} color="#B45309" />
              </View>
              <View>
                <Text style={styles.pendingSectionTitle}>Pending Transactions</Text>
                <Text style={styles.pendingSectionSub}>
                  {pendingTransactions.length === 0
                    ? 'No coins currently in escrow'
                    : `${pendingTransactions.length} ${
                        pendingTransactions.length === 1 ? 'session' : 'sessions'
                      } awaiting completion`}
                </Text>
              </View>
            </View>

            <View style={styles.pendingAmountBadge}>
              <MaterialCommunityIcons
                name="circle-multiple"
                size={14}
                color="#B45309"
              />
              <Text style={styles.pendingAmountText}>
                {pendingCoinsTotal} coins
              </Text>
            </View>
          </View>

          {pendingTransactions.length > 0 && (
            <View style={styles.pendingItemsList}>
              {pendingTransactions.map((tx) => {
                const isPositive =
                  isCreditType(tx.transaction_type) && tx.amount >= 0;
                const displayAmount = Math.abs(tx.amount ?? 0);

                return (
                  <View key={tx.id} style={styles.pendingItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingItemTitle} numberOfLines={1}>
                        {tx.description && tx.description.trim().length > 0
                          ? tx.description
                          : tx.transaction_type.replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.pendingItemMeta}>
                        {tx.transaction_type} · Held until session ends
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.pendingItemAmount,
                        isPositive ? styles.creditAmount : styles.pendingHoldText,
                      ]}>
                      {isPositive ? `+${displayAmount}` : `-${displayAmount}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Illustrated Coin Economy Banner */}
        <View style={styles.promoCard}>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=300&q=80',
            }}
            style={styles.promoImage}
          />
          <View style={styles.promoTextCol}>
            <Text style={styles.promoTag}>HOW COINS WORK</Text>
            <Text style={styles.promoTitle}>100% Peer-Powered Credits</Text>
            <Text style={styles.promoSubtitle}>
              Coins stay protected until your scheduled swap session completes.
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          <Text style={styles.sectionCount}>
            {filteredTransactions.length} records
          </Text>
        </View>

        <View style={styles.filterRow}>
          {(
            [
              ['ALL', 'All'],
              ['PENDING', `Pending (${pendingTransactions.length})`],
              ['CREDIT', 'Earned'],
              ['DEBIT', 'Spent'],
            ] as const
          ).map(([key, label]) => {
            const active = filter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                style={[styles.filterTab, active && styles.activeFilterTab]}>
                <Text
                  style={[
                    styles.filterTabText,
                    active && styles.activeFilterTabText,
                  ]}
                  numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Transactions List */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#7C3AED"
            style={{ marginTop: 32 }}
          />
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons
                name="circle-multiple-outline"
                size={30}
                color="#7C3AED"
              />
            </View>
            <Text style={styles.emptyTitle}>
              No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}transactions yet
            </Text>
            <Text style={styles.emptyText}>
              Your earned, spent, and pending Skill Coins will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredTransactions.map((tx) => {
              const isPositive =
                isCreditType(tx.transaction_type) && tx.amount >= 0;
              const isPending = tx.status?.toUpperCase() === 'PENDING';
              const displayAmount = Math.abs(tx.amount ?? 0);

              return (
                <View
                  key={tx.id}
                  style={[styles.txCard, isPending && styles.pendingTxCard]}>
                  <View
                    style={[
                      styles.txIconCircle,
                      isPending
                        ? styles.pendingCircle
                        : isPositive
                        ? styles.creditCircle
                        : styles.debitCircle,
                    ]}>
                    <Ionicons
                      name={
                        isPending
                          ? 'time-outline'
                          : isPositive
                          ? 'arrow-down-outline'
                          : 'arrow-up-outline'
                      }
                      size={20}
                      color={
                        isPending
                          ? '#B45309'
                          : isPositive
                          ? '#16A34A'
                          : '#7C3AED'
                      }
                    />
                  </View>

                  <View style={styles.txMiddle}>
                    <Text style={styles.txDescription} numberOfLines={1}>
                      {tx.description && tx.description.trim().length > 0
                        ? tx.description
                        : tx.transaction_type.replace(/_/g, ' ')}
                    </Text>

                    <View style={styles.txMetaRow}>
                      <Text style={styles.txType}>
                        {tx.transaction_type}
                      </Text>
                      <View
                        style={[
                          styles.statusPill,
                          tx.status?.toUpperCase() === 'COMPLETED'
                            ? styles.completedPill
                            : styles.pendingPill,
                        ]}>
                        <Text
                          style={[
                            styles.statusText,
                            tx.status?.toUpperCase() === 'COMPLETED'
                              ? styles.completedText
                              : styles.pendingText,
                          ]}>
                          {tx.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.txRight}>
                    <Text
                      style={[
                        styles.txAmount,
                        isPositive ? styles.creditAmount : styles.debitAmount,
                      ]}>
                      {isPositive ? `+${displayAmount}` : `-${displayAmount}`}
                    </Text>
                    <Text style={styles.txCoinLabel}>coins</Text>
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
  balanceCard: {
    backgroundColor: '#4C1D95',
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  balanceWatermark: {
    position: 'absolute',
    right: -18,
    top: -16,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  walletLabelText: {
    color: '#EDE9FE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  balanceMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  goldCoinEmblem: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(250, 204, 21, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(250, 204, 21, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 40,
  },
  balanceUnit: {
    fontSize: 13,
    color: '#C4B5FD',
    fontWeight: '600',
  },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  balanceHint: {
    flex: 1,
    fontSize: 12,
    color: '#DDD6FE',
  },
  pendingSectionCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  pendingTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pendingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350F',
  },
  pendingSectionSub: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 1,
  },
  pendingAmountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  pendingAmountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  pendingItemsList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    gap: 8,
  },
  pendingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  pendingItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  pendingItemMeta: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },
  pendingItemAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  pendingHoldText: {
    color: '#B45309',
  },
  promoCard: {
    backgroundColor: '#EDE9FE',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 22,
  },
  promoImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
  },
  promoTextCol: {
    flex: 1,
  },
  promoTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 2,
  },
  promoSubtitle: {
    fontSize: 12,
    color: '#5B21B6',
    lineHeight: 16,
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
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    alignItems: 'center',
  },
  activeFilterTab: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B0764',
  },
  activeFilterTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    gap: 10,
  },
  txCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  pendingTxCard: {
    borderColor: '#FDE68A',
  },
  txIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditCircle: {
    backgroundColor: '#DCFCE7',
  },
  debitCircle: {
    backgroundColor: '#F3E8FF',
  },
  pendingCircle: {
    backgroundColor: '#FEF3C7',
  },
  txMiddle: {
    flex: 1,
  },
  txDescription: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  completedPill: {
    backgroundColor: '#F3E8FF',
  },
  pendingPill: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  completedText: {
    color: '#7C3AED',
  },
  pendingText: {
    color: '#B45309',
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 17,
    fontWeight: '800',
  },
  creditAmount: {
    color: '#16A34A',
  },
  debitAmount: {
    color: '#1E1B4B',
  },
  txCoinLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
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