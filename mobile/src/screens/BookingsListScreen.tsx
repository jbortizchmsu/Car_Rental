import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import { FileText, ChevronRight } from 'lucide-react-native';
import { bookingsApi } from '../services/api';

const STATUS_FILTERS = ['All', 'Active', 'Pending', 'Completed', 'Cancelled'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const STATUS_MAP: Record<StatusFilter, string[]> = {
  All: [],
  Active: ['ACTIVE', 'READY_FOR_PICKUP', 'RESERVED'],
  Pending: ['PENDING_REVIEW', 'APPROVED_FOR_PAYMENT', 'FULL_PAYMENT_SUBMITTED', 'DOWNPAYMENT_SUBMITTED'],
  Completed: ['COMPLETED', 'RETURNED'],
  Cancelled: ['CANCELLED', 'REJECTED'],
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_REVIEW: '#F59E0B',
  APPROVED_FOR_PAYMENT: '#3B82F6',
  FULL_PAYMENT_SUBMITTED: '#6366F1',
  DOWNPAYMENT_SUBMITTED: '#8B5CF6',
  RESERVED: '#10B981',
  READY_FOR_PICKUP: '#059669',
  ACTIVE: '#7B1FA2',
  RETURNED: '#6B7280',
  COMPLETED: '#374151',
  CANCELLED: '#9CA3AF',
  REJECTED: '#EF4444',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'Pending Review',
  APPROVED_FOR_PAYMENT: 'Pay Now',
  FULL_PAYMENT_SUBMITTED: 'Payment Submitted',
  DOWNPAYMENT_SUBMITTED: 'DP Submitted',
  RESERVED: 'Reserved',
  READY_FOR_PICKUP: 'Ready for Pickup',
  ACTIVE: 'Active',
  RETURNED: 'Returned',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

export default function BookingsListScreen({ navigation }: any) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
      const response = await bookingsApi.getMyBookings();
      setBookings(Array.isArray(response.data) ? response.data : []);
    } catch (e: any) {
      setError('Could not load bookings. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const filtered = filter === 'All'
    ? bookings
    : bookings.filter(b => STATUS_MAP[filter].includes(b.status));

  const countFor = (f: StatusFilter) =>
    f === 'All' ? bookings.length : bookings.filter(b => STATUS_MAP[f].includes(b.status)).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerCount}>{bookings.length} total</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
              {f} {countFor(f) > 0 ? `(${countFor(f)})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#AD9B8D" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchBookings}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchBookings(); }}
              colors={['#AD9B8D']}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <FileText size={56} stroke="#DDD" />
              <Text style={styles.emptyTitle}>No bookings here</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'All' ? "You haven't made any bookings yet." : `No ${filter.toLowerCase()} bookings.`}
              </Text>
            </View>
          ) : (
            filtered.map(booking => (
              <TouchableOpacity
                key={booking.id}
                style={styles.card}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.vehicleName}>
                      {booking.vehicle?.brand} {booking.vehicle?.model}
                    </Text>
                    <Text style={styles.plateText}>{booking.vehicle?.licensePlate}</Text>
                    <Text style={styles.dateText}>
                      {formatDate(booking.startDate)} — {formatDate(booking.endDate)}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <View style={[styles.badge, { backgroundColor: STATUS_COLOR[booking.status] || '#9CA3AF' }]}>
                      <Text style={styles.badgeText}>{STATUS_LABEL[booking.status] || booking.status}</Text>
                    </View>
                    <Text style={styles.amountText}>₱{Number(booking.totalAmount).toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.footerId}>
                    ID: {booking.id.slice(0, 8).toUpperCase()}
                  </Text>
                  <View style={styles.footerRight}>
                    <Text style={styles.footerDocs}>
                      {booking.documents?.length || 0} docs
                    </Text>
                    <ChevronRight size={16} stroke="#9CA3AF" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFDFD' },
  header: {
    backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 15,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  headerCount: { color: '#AD9B8D', fontSize: 13, fontWeight: '600' },
  filterScroll: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: { backgroundColor: '#000' },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterLabelActive: { color: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#AD9B8D', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFF', fontWeight: '700' },
  scrollContent: { padding: 16 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 8 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardLeft: { flex: 1, marginRight: 12 },
  vehicleName: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 2 },
  plateText: { fontSize: 12, fontWeight: '600', color: '#958786', marginBottom: 4 },
  dateText: { fontSize: 12, color: '#6B7280' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  amountText: { fontSize: 15, fontWeight: '800', color: '#000' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F9FAFB',
  },
  footerId: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerDocs: { fontSize: 11, color: '#9CA3AF' },
});
