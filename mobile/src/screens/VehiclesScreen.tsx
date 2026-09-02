import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, SafeAreaView, Image,
  RefreshControl,
} from 'react-native';
import { Search, Car, Users, Fuel, Calendar } from 'lucide-react-native';
import { vehiclesApi } from '../services/api';

const CATEGORY_COLOR: Record<string, string> = {
  Sedan: '#DBEAFE',
  SUV: '#D1FAE5',
  Van: '#FEF3C7',
  Pickup: '#FEE2E2',
  Luxury: '#EDE9FE',
};

export default function VehiclesScreen({ navigation, route }: any) {
  const { pickupDate, returnDate } = route.params || {};

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      setError(null);
      const res = pickupDate && returnDate
        ? await vehiclesApi.getAvailableWithDates(pickupDate, returnDate)
        : await vehiclesApi.getAvailable();
      setVehicles(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError('Could not load vehicles. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pickupDate, returnDate]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const filtered = vehicles.filter(v => {
    const q = searchQuery.toLowerCase();
    return !q || v.brand.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || v.category?.toLowerCase().includes(q);
  });

  const renderVehicle = ({ item }: { item: any }) => {
    const available = item.status === 'AVAILABLE';
    const imgUrl = vehiclesApi.getImageUrl(item.id);

    return (
      <TouchableOpacity
        style={[styles.card, !available && styles.cardDisabled]}
        onPress={() => available && navigation.navigate('BookingForm', { vehicle: item })}
        activeOpacity={available ? 0.7 : 1}
      >
        {/* Vehicle image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imgUrl }}
            style={styles.vehicleImage}
            resizeMode="cover"
            onError={() => {}} // silently fail — fallback bg shows
          />
          <View style={[
            styles.statusBadge,
            { backgroundColor: available ? '#10B981' : '#EF4444' }
          ]}>
            <Text style={styles.statusBadgeText}>{available ? 'Available' : 'Unavailable'}</Text>
          </View>
          <View style={[
            styles.categoryBadge,
            { backgroundColor: CATEGORY_COLOR[item.category] || '#F3F4F6' }
          ]}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.vehicleName}>{item.brand} {item.model}</Text>
          {item.year && <Text style={styles.vehicleYear}>{item.year}</Text>}

          <View style={styles.specRow}>
            <View style={styles.spec}>
              <Users size={13} stroke="#9CA3AF" />
              <Text style={styles.specText}>{item.seats} seats</Text>
            </View>
            <View style={styles.spec}>
              <Fuel size={13} stroke="#9CA3AF" />
              <Text style={styles.specText}>{item.fuelType}</Text>
            </View>
            <View style={styles.spec}>
              <Car size={13} stroke="#9CA3AF" />
              <Text style={styles.specText}>{item.transmission}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.rate}>₱{Number(item.dailyRate).toLocaleString()}</Text>
              <Text style={styles.rateLabel}>per day</Text>
            </View>
            {available && (
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => navigation.navigate('BookingForm', { vehicle: item })}
              >
                <Calendar size={14} stroke="#FFF" />
                <Text style={styles.bookBtnText}>Book Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Browse Vehicles</Text>
        <Text style={styles.headerSub}>{filtered.length} available</Text>
      </View>

      <View style={styles.searchWrapper}>
        <Search size={18} stroke="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by brand, model, type..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#AD9B8D" />
          <Text style={styles.loadingText}>Loading vehicles...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchVehicles}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Car size={56} stroke="#E5E7EB" />
          <Text style={styles.emptyTitle}>No vehicles found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try a different search term.' : 'No vehicles available for the selected dates.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderVehicle}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchVehicles(); }}
              colors={['#AD9B8D']}
            />
          }
        />
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
  headerSub: { color: '#AD9B8D', fontSize: 13, fontWeight: '600' },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', margin: 16,
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 10 },
  loadingText: { color: '#958786', marginTop: 8 },
  errorText: { color: '#EF4444', textAlign: 'center' },
  retryBtn: { backgroundColor: '#AD9B8D', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFF', fontWeight: '700' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 8 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 30 },
  card: {
    backgroundColor: '#FFF', borderRadius: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
    overflow: 'hidden',
  },
  cardDisabled: { opacity: 0.6 },
  imageContainer: {
    height: 180, backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  vehicleImage: { width: '100%', height: '100%' },
  statusBadge: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  categoryBadge: {
    position: 'absolute', bottom: 10, left: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  categoryText: { fontSize: 10, fontWeight: '800', color: '#374151' },
  cardBody: { padding: 16 },
  vehicleName: { fontSize: 18, fontWeight: '800', color: '#000', marginBottom: 2 },
  vehicleYear: { fontSize: 12, color: '#9CA3AF', marginBottom: 10 },
  specRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  specText: { fontSize: 12, color: '#6B7280' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rate: { fontSize: 22, fontWeight: '900', color: '#000' },
  rateLabel: { fontSize: 11, color: '#9CA3AF' },
  bookBtn: {
    backgroundColor: '#000', flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
  },
  bookBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
});
