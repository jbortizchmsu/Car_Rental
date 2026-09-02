import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, Calendar, MapPin, CreditCard, CheckCircle2,
  Navigation as NavIcon, RotateCcw, AlertCircle, FileText,
  Upload, X, Clock,
} from 'lucide-react-native';
import { bookingsApi } from '../services/api';

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
  APPROVED_FOR_PAYMENT: 'Approved — Pay Now',
  FULL_PAYMENT_SUBMITTED: 'Full Payment Submitted',
  DOWNPAYMENT_SUBMITTED: 'Downpayment Submitted',
  RESERVED: 'Reserved',
  READY_FOR_PICKUP: 'Ready for Pickup',
  ACTIVE: 'Rental Active',
  RETURNED: 'Returned — Awaiting Completion',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export default function BookingDetailScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      setError(null);
      const res = await bookingsApi.getBookingDetail(bookingId);
      setBooking(res.data);
    } catch (e: any) {
      setError('Could not load booking details.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleCancel = () => {
    const isReadyForPickup = booking?.status === 'READY_FOR_PICKUP';
    Alert.alert(
      isReadyForPickup ? 'Request Cancellation' : 'Cancel Booking',
      isReadyForPickup
        ? 'You have already paid. Cancellation is subject to admin review and refund policy.'
        : 'Are you sure you want to cancel this booking? This cannot be undone.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: isReadyForPickup ? 'Submit Request' : 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await bookingsApi.cancelBooking(bookingId);
              Alert.alert('Done', isReadyForPickup ? 'Cancellation request submitted.' : 'Booking cancelled.');
              fetchDetail();
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error || 'Could not cancel booking.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const pickAndUpload = async (docType: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploading(true);
      const formData = new FormData();
      formData.append('type', docType);
      formData.append('bookingId', bookingId);
      // @ts-ignore
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName || `upload_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      try {
        await bookingsApi.uploadDocument(bookingId, formData);
        Alert.alert('Uploaded', `${docType === 'valid_id' ? 'Valid ID' : "Driver's License"} uploaded.`);
        fetchDetail();
      } catch {
        Alert.alert('Upload Failed', 'Could not upload document.');
      } finally {
        setUploading(false);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} stroke="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#AD9B8D" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} stroke="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <AlertCircle size={40} stroke="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDetail}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canCancel = ['PENDING_REVIEW', 'APPROVED_FOR_PAYMENT'].includes(booking.status);
  const canRequestCancel = booking.status === 'READY_FOR_PICKUP';
  const canPay = booking.status === 'APPROVED_FOR_PAYMENT';
  const hasId = booking.documents?.some((d: any) => d.documentType === 'valid_id');
  const hasLicense = booking.documents?.some((d: any) => d.documentType === 'drivers_license');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} stroke="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: STATUS_COLOR[booking.status] || '#9CA3AF' }]}>
          <Text style={styles.statusLabel}>{STATUS_LABEL[booking.status] || booking.status}</Text>
          <Text style={styles.statusAmount}>₱{Number(booking.totalAmount).toLocaleString()}</Text>
        </View>

        {/* Vehicle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <Text style={styles.vehicleName}>{booking.vehicle?.brand} {booking.vehicle?.model}</Text>
          <Text style={styles.detail}>Plate: {booking.vehicle?.licensePlate}</Text>
          <Text style={styles.detail}>{booking.vehicle?.category} · {booking.vehicle?.transmission} · {booking.vehicle?.fuelType}</Text>
        </View>

        {/* Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.row}>
            <Calendar size={15} stroke="#AD9B8D" />
            <Text style={styles.detail}>Pickup: {formatDate(booking.startDate)}</Text>
          </View>
          <View style={styles.row}>
            <Calendar size={15} stroke="#AD9B8D" />
            <Text style={styles.detail}>Return: {formatDate(booking.endDate)}</Text>
          </View>
          <View style={styles.row}>
            <MapPin size={15} stroke="#AD9B8D" />
            <Text style={styles.detail}>{booking.pickupLocation}</Text>
          </View>
          {booking.destinationName && (
            <View style={styles.row}>
              <NavIcon size={15} stroke="#AD9B8D" />
              <Text style={styles.detail}>Destination: {booking.destinationName}</Text>
            </View>
          )}
        </View>

        {/* Timeline */}
        {(booking.releasedAt || booking.returnedAt || booking.completedAt) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rental Timeline</Text>
            {booking.releasedAt && (
              <View style={styles.row}>
                <Clock size={14} stroke="#AD9B8D" />
                <Text style={styles.detail}>Released: {formatDate(booking.releasedAt)}</Text>
              </View>
            )}
            {booking.returnedAt && (
              <View style={styles.row}>
                <RotateCcw size={14} stroke="#AD9B8D" />
                <Text style={styles.detail}>Returned: {formatDate(booking.returnedAt)}</Text>
              </View>
            )}
            {booking.completedAt && (
              <View style={styles.row}>
                <CheckCircle2 size={14} stroke="#10B981" />
                <Text style={styles.detail}>Completed: {formatDate(booking.completedAt)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Rejection reason */}
        {booking.rejectionReason && (
          <View style={[styles.section, styles.rejectionBox]}>
            <Text style={styles.rejectionTitle}>Admin Feedback</Text>
            <Text style={styles.rejectionText}>{booking.rejectionReason}</Text>
          </View>
        )}

        {/* Documents */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Documents</Text>
            <TouchableOpacity onPress={() => setShowUploadModal(true)}>
              <Text style={styles.uploadLink}>Manage</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.docRow}>
            <View style={[styles.docBadge, { backgroundColor: hasId ? '#D1FAE5' : '#FEE2E2' }]}>
              {hasId ? <CheckCircle2 size={16} stroke="#10B981" /> : <Upload size={16} stroke="#EF4444" />}
              <Text style={[styles.docLabel, { color: hasId ? '#065F46' : '#991B1B' }]}>Valid ID</Text>
            </View>
            <View style={[styles.docBadge, { backgroundColor: hasLicense ? '#D1FAE5' : '#FEE2E2' }]}>
              {hasLicense ? <CheckCircle2 size={16} stroke="#10B981" /> : <Upload size={16} stroke="#EF4444" />}
              <Text style={[styles.docLabel, { color: hasLicense ? '#065F46' : '#991B1B' }]}>Driver's License</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        {canPay && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('PaymentSubmit', {
              bookingId: booking.id,
              totalAmount: booking.totalAmount,
            })}
          >
            <CreditCard size={18} stroke="#FFF" />
            <Text style={styles.primaryBtnText}>Pay Now</Text>
          </TouchableOpacity>
        )}

        {(canCancel || canRequestCancel) && (
          <TouchableOpacity
            style={[styles.dangerBtn, cancelling && { opacity: 0.5 }]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling
              ? <ActivityIndicator color="#EF4444" size="small" />
              : <Text style={styles.dangerBtnText}>
                  {canRequestCancel ? 'Request Cancellation' : 'Cancel Booking'}
                </Text>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Document Upload Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Documents</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <X size={22} stroke="#000" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 12 }}>
              <TouchableOpacity
                style={[styles.uploadRow, { backgroundColor: hasId ? '#D1FAE5' : '#F9FAFB' }]}
                onPress={() => pickAndUpload('valid_id')}
                disabled={uploading}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadTitle}>Valid ID</Text>
                  <Text style={styles.uploadSubtitle}>Passport, SSS, PhilHealth, etc.</Text>
                </View>
                {hasId
                  ? <CheckCircle2 size={22} stroke="#10B981" />
                  : <Upload size={22} stroke="#AD9B8D" />
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadRow, { backgroundColor: hasLicense ? '#D1FAE5' : '#F9FAFB' }]}
                onPress={() => pickAndUpload('drivers_license')}
                disabled={uploading}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadTitle}>Driver's License</Text>
                  <Text style={styles.uploadSubtitle}>Must be valid and unexpired</Text>
                </View>
                {hasLicense
                  ? <CheckCircle2 size={22} stroke="#10B981" />
                  : <Upload size={22} stroke="#AD9B8D" />
                }
              </TouchableOpacity>

              {uploading && (
                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <ActivityIndicator color="#AD9B8D" />
                  <Text style={{ marginTop: 6, color: '#958786', fontSize: 13 }}>Uploading...</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFDFD' },
  header: {
    backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 15,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  backBtn: { width: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  errorText: { color: '#EF4444', textAlign: 'center' },
  retryBtn: { backgroundColor: '#AD9B8D', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFF', fontWeight: '700' },
  scroll: { padding: 16 },
  statusBanner: {
    borderRadius: 16, padding: 18, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  statusLabel: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  statusAmount: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  section: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  uploadLink: { color: '#AD9B8D', fontSize: 13, fontWeight: '700' },
  vehicleName: { fontSize: 18, fontWeight: '800', color: '#000', marginBottom: 4 },
  detail: { fontSize: 14, color: '#6B7280', marginLeft: 6 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  rejectionBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  rejectionTitle: { fontSize: 11, fontWeight: '800', color: '#991B1B', textTransform: 'uppercase', marginBottom: 6 },
  rejectionText: { fontSize: 13, color: '#7F1D1D' },
  docRow: { flexDirection: 'row', gap: 10 },
  docBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 10, borderRadius: 10,
  },
  docLabel: { fontSize: 12, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8, marginBottom: 8,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  dangerBtn: {
    borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 4, marginBottom: 8,
  },
  dangerBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: {
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  uploadRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6',
  },
  uploadTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  uploadSubtitle: { fontSize: 12, color: '#958786' },
});
