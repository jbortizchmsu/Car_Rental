import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, Modal, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, Calendar, MapPin, CreditCard, CheckCircle2,
  Navigation as NavIcon, RotateCcw, AlertCircle, FileText,
  Upload, X, Clock, Eye,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bookingsApi, filesApi } from '../services/api';

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

  // Full-size Document Preview State
  const [userToken, setUserToken] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [viewingImageTitle, setViewingImageTitle] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [fetchingSignedUrl, setFetchingSignedUrl] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastPreviewReqId = useRef(0);

  // Map of document ID to signed URL & loading states
  const [docSignedUrls, setDocSignedUrls] = useState<Record<string, string>>({});
  const [docLoading, setDocLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    AsyncStorage.getItem('jd_token').then(t => setUserToken(t));
  }, []);

  const openDocumentPreview = async (doc: any, title: string) => {
    if (!doc?.id) return;
    const reqId = ++lastPreviewReqId.current;
    setPreviewVisible(true);
    setViewingImageTitle(title);
    setViewingDoc(doc);
    setImageError(false);
    setErrorMessage(null);
    setFetchingSignedUrl(true);
    setViewingImageUri(null);

    try {
      // Always fetch a fresh signed URL for full-size viewing
      const url = await filesApi.getSignedUrl(doc.id);
      console.log('===SIGNED_URL_START===');
      console.log(url);
      console.log('===SIGNED_URL_END===');
      if (reqId !== lastPreviewReqId.current) return;
      if (!url || typeof url !== 'string' || url.trim() === '') {
        throw new Error('Document preview URL is missing or empty.');
      }
      setDocSignedUrls(prev => ({ ...prev, [doc.id]: url }));
      setViewingImageUri(url);
    } catch (err: any) {
      if (reqId !== lastPreviewReqId.current) return;
      setImageError(true);
      if (err.response?.status === 403) {
        setErrorMessage('You do not have permission to view this document.');
      } else if (err.response?.status === 404) {
        setErrorMessage('The requested document file could not be found.');
      } else {
        setErrorMessage(err.message || 'Network error. Please check your connection and try again.');
      }
    } finally {
      if (reqId === lastPreviewReqId.current) {
        setFetchingSignedUrl(false);
      }
    }
  };

  const closePreviewModal = () => {
    setPreviewVisible(false);
    setViewingImageUri(null);
    setImageError(false);
    setFetchingSignedUrl(false);
    setImageLoading(false);
  };

  const retryLoadPreview = () => {
    if (viewingDoc && viewingImageTitle) {
      openDocumentPreview(viewingDoc, viewingImageTitle);
    }
  };

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

  // Pre-fetch signed URLs for document thumbnails
  useEffect(() => {
    if (booking?.documents && Array.isArray(booking.documents)) {
      booking.documents.forEach(async (d: any) => {
        if (d?.id && !docSignedUrls[d.id] && !docLoading[d.id]) {
          setDocLoading(prev => ({ ...prev, [d.id]: true }));
          try {
            const url = await filesApi.getSignedUrl(d.id);
            setDocSignedUrls(prev => ({ ...prev, [d.id]: url }));
          } catch (e) {
            console.warn('Failed to pre-fetch signed URL for thumbnail:', d.id);
          } finally {
            setDocLoading(prev => ({ ...prev, [d.id]: false }));
          }
        }
      });
    }
  }, [booking]);

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
      } catch (e: any) {
        const msg = e.response?.data?.error || 'Could not upload document.';
        Alert.alert('Upload Failed', msg);
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
  
  const idDoc = booking.documents?.find((d: any) => d.documentType === 'valid_id');
  const licenseDoc = booking.documents?.find((d: any) => d.documentType === 'drivers_license');
  const isRejected = booking.status === 'REJECTED';
  const isClosed = ['CANCELLED', 'COMPLETED', 'ACTIVE', 'RETURNED'].includes(booking.status);

  // Document upload is permitted ONLY if missing or if admin explicitly REJECTED the document/booking
  const canEditId = (!idDoc || isRejected) && !isClosed;
  const canEditLicense = (!licenseDoc || isRejected) && !isClosed;

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
            <Text style={styles.sectionTitle}>Submitted Documents</Text>
            <TouchableOpacity onPress={() => setShowUploadModal(true)}>
              <Text style={styles.uploadLink}>Manage</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.docCardsList}>
            {/* Valid ID Card */}
            <View style={styles.docCard}>
              <View style={styles.docCardHeader}>
                <TouchableOpacity
                  style={styles.docThumbnailContainer}
                  onPress={() => idDoc && openDocumentPreview(idDoc, 'Valid ID')}
                  disabled={!idDoc}
                  activeOpacity={idDoc ? 0.8 : 1}
                >
                  {idDoc ? (
                    docSignedUrls[idDoc.id] ? (
                      <Image
                        source={{ uri: docSignedUrls[idDoc.id] }}
                        style={styles.docThumbnailImage}
                        resizeMode="cover"
                      />
                    ) : docLoading[idDoc.id] ? (
                      <ActivityIndicator size="small" color="#AD9B8D" />
                    ) : (
                      <FileText size={24} stroke="#AD9B8D" />
                    )
                  ) : (
                    <Upload size={22} stroke="#9CA3AF" />
                  )}
                  {idDoc && (
                    <View style={styles.thumbnailOverlayBadge}>
                      <Eye size={12} stroke="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.docCardDetails}>
                  <Text style={styles.docCardTitle}>Valid ID</Text>
                  <Text style={styles.docCardSubtitle}>Passport, SSS, PhilHealth, etc.</Text>
                  {idDoc?.createdAt && (
                    <Text style={styles.docCardDate}>
                      Uploaded {new Date(idDoc.createdAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>

                {/* Status Badge */}
                <View style={[
                  styles.statusBadge,
                  idDoc
                    ? (isRejected
                        ? styles.statusBadgeRejected
                        : (idDoc.verifiedAt ? styles.statusBadgeVerified : styles.statusBadgePending))
                    : styles.statusBadgeMissing
                ]}>
                  {idDoc ? (
                    isRejected ? (
                      <>
                        <AlertCircle size={12} stroke="#DC2626" />
                        <Text style={[styles.statusBadgeText, { color: '#DC2626' }]}>Rejected</Text>
                      </>
                    ) : idDoc.verifiedAt ? (
                      <>
                        <CheckCircle2 size={12} stroke="#059669" />
                        <Text style={[styles.statusBadgeText, { color: '#059669' }]}>Approved</Text>
                      </>
                    ) : (
                      <>
                        <Clock size={12} stroke="#D97706" />
                        <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>Pending</Text>
                      </>
                    )
                  ) : (
                    <Text style={[styles.statusBadgeText, { color: '#6B7280' }]}>Missing</Text>
                  )}
                </View>
              </View>

              {/* Card Footer Actions */}
              <View style={styles.docCardFooter}>
                {idDoc && (
                  <TouchableOpacity
                    style={styles.cardViewBtn}
                    onPress={() => openDocumentPreview(idDoc, 'Valid ID')}
                  >
                    <Eye size={14} stroke="#2563EB" />
                    <Text style={styles.cardViewBtnText}>View Full Size</Text>
                  </TouchableOpacity>
                )}
                {canEditId && (
                  <TouchableOpacity
                    style={styles.cardUploadBtn}
                    onPress={() => pickAndUpload('valid_id')}
                  >
                    <Upload size={14} stroke="#FFF" />
                    <Text style={styles.cardUploadBtnText}>{idDoc ? 'Re-upload' : 'Upload ID'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Driver's License Card */}
            <View style={styles.docCard}>
              <View style={styles.docCardHeader}>
                <TouchableOpacity
                  style={styles.docThumbnailContainer}
                  onPress={() => licenseDoc && openDocumentPreview(licenseDoc, "Driver's License")}
                  disabled={!licenseDoc}
                  activeOpacity={licenseDoc ? 0.8 : 1}
                >
                  {licenseDoc ? (
                    docSignedUrls[licenseDoc.id] ? (
                      <Image
                        source={{ uri: docSignedUrls[licenseDoc.id] }}
                        style={styles.docThumbnailImage}
                        resizeMode="cover"
                      />
                    ) : docLoading[licenseDoc.id] ? (
                      <ActivityIndicator size="small" color="#AD9B8D" />
                    ) : (
                      <FileText size={24} stroke="#AD9B8D" />
                    )
                  ) : (
                    <Upload size={22} stroke="#9CA3AF" />
                  )}
                  {licenseDoc && (
                    <View style={styles.thumbnailOverlayBadge}>
                      <Eye size={12} stroke="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.docCardDetails}>
                  <Text style={styles.docCardTitle}>Driver's License</Text>
                  <Text style={styles.docCardSubtitle}>Must be valid and unexpired</Text>
                  {licenseDoc?.createdAt && (
                    <Text style={styles.docCardDate}>
                      Uploaded {new Date(licenseDoc.createdAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>

                {/* Status Badge */}
                <View style={[
                  styles.statusBadge,
                  licenseDoc
                    ? (isRejected
                        ? styles.statusBadgeRejected
                        : (licenseDoc.verifiedAt ? styles.statusBadgeVerified : styles.statusBadgePending))
                    : styles.statusBadgeMissing
                ]}>
                  {licenseDoc ? (
                    isRejected ? (
                      <>
                        <AlertCircle size={12} stroke="#DC2626" />
                        <Text style={[styles.statusBadgeText, { color: '#DC2626' }]}>Rejected</Text>
                      </>
                    ) : licenseDoc.verifiedAt ? (
                      <>
                        <CheckCircle2 size={12} stroke="#059669" />
                        <Text style={[styles.statusBadgeText, { color: '#059669' }]}>Approved</Text>
                      </>
                    ) : (
                      <>
                        <Clock size={12} stroke="#D97706" />
                        <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>Pending</Text>
                      </>
                    )
                  ) : (
                    <Text style={[styles.statusBadgeText, { color: '#6B7280' }]}>Missing</Text>
                  )}
                </View>
              </View>

              {/* Card Footer Actions */}
              <View style={styles.docCardFooter}>
                {licenseDoc && (
                  <TouchableOpacity
                    style={styles.cardViewBtn}
                    onPress={() => openDocumentPreview(licenseDoc, "Driver's License")}
                  >
                    <Eye size={14} stroke="#2563EB" />
                    <Text style={styles.cardViewBtnText}>View Full Size</Text>
                  </TouchableOpacity>
                )}
                {canEditLicense && (
                  <TouchableOpacity
                    style={styles.cardUploadBtn}
                    onPress={() => pickAndUpload('drivers_license')}
                  >
                    <Upload size={14} stroke="#FFF" />
                    <Text style={styles.cardUploadBtnText}>{licenseDoc ? 'Re-upload' : 'Upload License'}</Text>
                  </TouchableOpacity>
                )}
              </View>
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

      {/* Document Upload / Manage Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Documents</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <X size={22} stroke="#000" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>
                {isRejected
                  ? 'Admin requested document re-upload. Tap a document below to upload a new file.'
                  : 'Submitted documents cannot be changed while under review or after approval.'}
              </Text>

              {/* Valid ID Row */}
              <TouchableOpacity
                style={[
                  styles.uploadRow,
                  { backgroundColor: canEditId ? '#FFF' : '#F0FDF4', opacity: canEditId ? 1 : 0.95 }
                ]}
                onPress={() => canEditId && pickAndUpload('valid_id')}
                disabled={!canEditId || uploading}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadTitle}>Valid ID</Text>
                  <Text style={styles.uploadSubtitle}>
                    {idDoc
                      ? (isRejected ? 'Rejected — Tap to re-upload new photo' : (idDoc.verifiedAt ? 'Verified by Admin (Locked)' : 'Submitted — Pending Review (Locked)'))
                      : 'Passport, SSS, PhilHealth, etc.'}
                  </Text>
                  {idDoc && (
                    <TouchableOpacity
                      style={styles.viewPhotoBtn}
                      onPress={() => openDocumentPreview(idDoc, 'Valid ID')}
                    >
                      <Eye size={14} stroke="#2563EB" />
                      <Text style={styles.viewPhotoText}>View Submitted Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {canEditId
                  ? <Upload size={22} stroke="#AD9B8D" />
                  : <CheckCircle2 size={22} stroke="#10B981" />
                }
              </TouchableOpacity>

              {/* Driver's License Row */}
              <TouchableOpacity
                style={[
                  styles.uploadRow,
                  { backgroundColor: canEditLicense ? '#FFF' : '#F0FDF4', opacity: canEditLicense ? 1 : 0.95 }
                ]}
                onPress={() => canEditLicense && pickAndUpload('drivers_license')}
                disabled={!canEditLicense || uploading}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadTitle}>Driver's License</Text>
                  <Text style={styles.uploadSubtitle}>
                    {licenseDoc
                      ? (isRejected ? 'Rejected — Tap to re-upload new photo' : (licenseDoc.verifiedAt ? 'Verified by Admin (Locked)' : 'Submitted — Pending Review (Locked)'))
                      : 'Must be valid and unexpired'}
                  </Text>
                  {licenseDoc && (
                    <TouchableOpacity
                      style={styles.viewPhotoBtn}
                      onPress={() => openDocumentPreview(licenseDoc, "Driver's License")}
                    >
                      <Eye size={14} stroke="#2563EB" />
                      <Text style={styles.viewPhotoText}>View Submitted Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {canEditLicense
                  ? <Upload size={22} stroke="#AD9B8D" />
                  : <CheckCircle2 size={22} stroke="#10B981" />
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

      {/* Full-screen Image Preview Modal */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={closePreviewModal}
      >
        <View style={styles.imagePreviewOverlay}>
          {/* Backdrop press handler */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closePreviewModal}
          />

          <SafeAreaView style={styles.imagePreviewContainer} pointerEvents="box-none">
            <View style={styles.imagePreviewHeader}>
              <Text style={styles.imagePreviewTitle}>{viewingImageTitle || 'Document Preview'}</Text>
              <TouchableOpacity
                style={styles.imagePreviewCloseBtn}
                onPress={closePreviewModal}
              >
                <X size={22} stroke="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.imagePreviewBody}>
              {fetchingSignedUrl ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color="#FFF" />
                  <Text style={styles.modalLoadingText}>Generating secure preview...</Text>
                </View>
              ) : imageError ? (
                <View style={styles.modalErrorContainer}>
                  <AlertCircle size={44} stroke="#EF4444" />
                  <Text style={styles.modalErrorTitle}>Unable to Load Document</Text>
                  <Text style={styles.modalErrorText}>
                    {errorMessage || 'The requested document file could not be loaded.'}
                  </Text>
                  <TouchableOpacity style={styles.modalRetryBtn} onPress={retryLoadPreview}>
                    <Text style={styles.modalRetryText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : viewingImageUri ? (
                <View style={styles.imageWrapper}>
                  {imageLoading && (
                    <ActivityIndicator size="large" color="#FFF" style={styles.imageLoadingOverlay} />
                  )}
                  <Image
                    source={{ uri: viewingImageUri }}
                    style={styles.fullSizeImage}
                    resizeMode="contain"
                    onLoadStart={() => setImageLoading(true)}
                    onLoadEnd={() => setImageLoading(false)}
                    onError={() => {
                      setImageLoading(false);
                      setImageError(true);
                      setErrorMessage('The image file could not be rendered.');
                    }}
                  />
                </View>
              ) : null}
            </View>

            <Text style={styles.imagePreviewFooterHint}>Tap background or X to close</Text>
          </SafeAreaView>
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
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  uploadLink: { color: '#AD9B8D', fontSize: 13, fontWeight: '700' },
  vehicleName: { fontSize: 18, fontWeight: '800', color: '#000', marginBottom: 4 },
  detail: { fontSize: 14, color: '#6B7280', marginLeft: 6 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  rejectionBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  rejectionTitle: { fontSize: 11, fontWeight: '800', color: '#991B1B', textTransform: 'uppercase', marginBottom: 6 },
  rejectionText: { fontSize: 13, color: '#7F1D1D' },

  // Redesigned Document Cards
  docCardsList: { gap: 12 },
  docCard: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  docCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docThumbnailContainer: {
    width: 60, height: 60, borderRadius: 10, backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    position: 'relative', borderWidth: 1, borderColor: '#D1D5DB',
  },
  docThumbnailImage: { width: '100%', height: '100%' },
  thumbnailOverlayBadge: {
    position: 'absolute', bottom: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 3, borderRadius: 10,
  },
  docCardDetails: { flex: 1 },
  docCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  docCardSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  docCardDate: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statusBadgeVerified: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#A7F3D0' },
  statusBadgePending: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  statusBadgeRejected: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
  statusBadgeMissing: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  docCardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  cardViewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EFF6FF',
    borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE',
  },
  cardViewBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  cardUploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#000',
    borderRadius: 8, marginLeft: 'auto',
  },
  cardUploadBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

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
  viewPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#EFF6FF', borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE',
  },
  viewPhotoText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  imagePreviewOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  imagePreviewContainer: {
    flex: 1, justifyContent: 'space-between',
  },
  imagePreviewHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 10,
    zIndex: 10,
  },
  imagePreviewTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  imagePreviewCloseBtn: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 20 },
  imagePreviewBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  imageWrapper: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  imageLoadingOverlay: { position: 'absolute', zIndex: 5 },
  fullSizeImage: { width: '100%', height: '100%' },
  imagePreviewFooterHint: { color: '#9CA3AF', fontSize: 12, textAlign: 'center', paddingBottom: 24 },
  modalLoadingContainer: { alignItems: 'center', gap: 12 },
  modalLoadingText: { color: '#E5E7EB', fontSize: 14, fontWeight: '600' },
  modalErrorContainer: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)', padding: 24, borderRadius: 16,
    alignItems: 'center', gap: 10, maxWidth: 320, borderWidth: 1, borderColor: '#374151',
  },
  modalErrorTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  modalErrorText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  modalRetryBtn: {
    marginTop: 8, backgroundColor: '#EF4444', paddingHorizontal: 20,
    paddingVertical: 10, borderRadius: 8,
  },
  modalRetryText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
