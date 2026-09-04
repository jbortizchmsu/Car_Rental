import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, CheckCircle2, Upload, Smartphone, Banknote, CreditCard } from 'lucide-react-native';
import { paymentsApi } from '../services/api';

type PaymentType = 'FULL_GCASH' | 'DOWNPAYMENT_GCASH' | 'CASH_AT_PICKUP';

const GCASH_NUMBER = '0917-XXX-XXXX'; // Replace with actual GCash number

export default function PaymentScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { bookingId, totalAmount } = route.params;
  const downpaymentAmount = Math.ceil(Number(totalAmount) * 0.3);

  const [paymentType, setPaymentType] = useState<PaymentType>('FULL_GCASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [proofImage, setProofImage] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isGCash = paymentType !== 'CASH_AT_PICKUP';
  const amount = paymentType === 'DOWNPAYMENT_GCASH' ? downpaymentAmount : Number(totalAmount);

  const pickProof = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo access to upload payment proof.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProofImage(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (isGCash) {
      if (!referenceNumber.trim()) {
        Alert.alert('Required', 'Please enter the GCash reference number.');
        return;
      }
      if (!proofImage) {
        Alert.alert('Required', 'Please upload a screenshot of your payment proof.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('paymentType', paymentType);
      formData.append('amount', String(amount));

      if (isGCash) {
        formData.append('referenceNumber', referenceNumber.trim());
        // @ts-ignore
        formData.append('proof', {
          uri: proofImage.uri,
          name: proofImage.fileName || `payment_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      }

      await paymentsApi.submit(bookingId, formData);
      setSuccess(true);
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Payment submission failed. Please try again.';
      Alert.alert('Submission Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.successContainer}>
          <CheckCircle2 size={72} stroke="#10B981" />
          <Text style={styles.successTitle}>Payment Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Your payment is being verified by our team.{'\n'}
            We'll notify you once it's confirmed.
          </Text>
          <Text style={styles.refText}>Booking: {String(bookingId).slice(0, 8).toUpperCase()}</Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.navigate('BookingsList')}
          >
            <Text style={styles.doneBtnText}>Back to Bookings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} stroke="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Amount banner */}
          <View style={styles.amountBanner}>
            <Text style={styles.amountLabel}>Total Booking Amount</Text>
            <Text style={styles.amountValue}>₱{Number(totalAmount).toLocaleString()}</Text>
          </View>

          {/* Payment type selector */}
          <Text style={styles.sectionTitle}>Select Payment Method</Text>

          <TouchableOpacity
            style={[styles.paymentOption, paymentType === 'FULL_GCASH' && styles.paymentOptionActive]}
            onPress={() => setPaymentType('FULL_GCASH')}
          >
            <View style={[styles.paymentIcon, { backgroundColor: '#EDE9FE' }]}>
              <Smartphone size={20} stroke="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>Full Payment — GCash</Text>
              <Text style={styles.paymentAmount}>₱{Number(totalAmount).toLocaleString()}</Text>
            </View>
            <View style={[styles.radioOuter, paymentType === 'FULL_GCASH' && styles.radioActive]}>
              {paymentType === 'FULL_GCASH' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentOption, paymentType === 'DOWNPAYMENT_GCASH' && styles.paymentOptionActive]}
            onPress={() => setPaymentType('DOWNPAYMENT_GCASH')}
          >
            <View style={[styles.paymentIcon, { backgroundColor: '#DBEAFE' }]}>
              <CreditCard size={20} stroke="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>30% Downpayment — GCash</Text>
              <Text style={styles.paymentAmount}>₱{downpaymentAmount.toLocaleString()}</Text>
              <Text style={styles.paymentNote}>Remaining balance due at pickup</Text>
            </View>
            <View style={[styles.radioOuter, paymentType === 'DOWNPAYMENT_GCASH' && styles.radioActive]}>
              {paymentType === 'DOWNPAYMENT_GCASH' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentOption, paymentType === 'CASH_AT_PICKUP' && styles.paymentOptionActive]}
            onPress={() => setPaymentType('CASH_AT_PICKUP')}
          >
            <View style={[styles.paymentIcon, { backgroundColor: '#D1FAE5' }]}>
              <Banknote size={20} stroke="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>Cash at Pickup</Text>
              <Text style={styles.paymentAmount}>₱{Number(totalAmount).toLocaleString()}</Text>
              <Text style={styles.paymentNote}>Pay in full when you pick up the vehicle</Text>
            </View>
            <View style={[styles.radioOuter, paymentType === 'CASH_AT_PICKUP' && styles.radioActive]}>
              {paymentType === 'CASH_AT_PICKUP' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* GCash instructions */}
          {isGCash && (
            <View style={styles.gcashBox}>
              <Text style={styles.gcashTitle}>GCash Instructions</Text>
              <Text style={styles.gcashStep}>1. Open your GCash app</Text>
              <Text style={styles.gcashStep}>2. Send <Text style={{ fontWeight: '800' }}>₱{amount.toLocaleString()}</Text> to:</Text>
              <Text style={styles.gcashNumber}>{GCASH_NUMBER}</Text>
              <Text style={styles.gcashStep}>3. Enter your reference number and upload the screenshot below.</Text>
            </View>
          )}

          {/* GCash form fields */}
          {isGCash && (
            <>
              <Text style={styles.fieldLabel}>GCash Reference Number</Text>
              <TextInput
                style={styles.input}
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                placeholder="e.g. 1234567890"
                keyboardType="numeric"
                maxLength={20}
              />

              <Text style={styles.fieldLabel}>Payment Screenshot</Text>
              <TouchableOpacity style={styles.uploadArea} onPress={pickProof}>
                {proofImage ? (
                  <Image source={{ uri: proofImage.uri }} style={styles.proofPreview} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Upload size={28} stroke="#AD9B8D" />
                    <Text style={styles.uploadHint}>Tap to upload payment screenshot</Text>
                  </View>
                )}
              </TouchableOpacity>
              {proofImage && (
                <TouchableOpacity onPress={() => setProofImage(null)} style={styles.removeProof}>
                  <Text style={styles.removeProofText}>Remove photo</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Cash at pickup confirmation */}
          {!isGCash && (
            <View style={styles.cashBox}>
              <Banknote size={28} stroke="#059669" />
              <Text style={styles.cashTitle}>Cash Payment Confirmed</Text>
              <Text style={styles.cashNote}>
                Please bring the full amount of <Text style={{ fontWeight: '800' }}>₱{Number(totalAmount).toLocaleString()}</Text> when you pick up the vehicle. Our staff will process your payment on-site.
              </Text>
            </View>
          )}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.submitBtnText}>
                  {isGCash ? 'Submit Payment Proof' : 'Confirm Cash Payment'}
                </Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  scroll: { padding: 16 },
  amountBanner: {
    backgroundColor: '#000', borderRadius: 16, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  amountLabel: { color: '#958786', fontSize: 12, fontWeight: '600' },
  amountValue: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  paymentOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#F3F4F6',
    backgroundColor: '#FFF', marginBottom: 10,
  },
  paymentOptionActive: { borderColor: '#000', backgroundColor: '#F9FAFB' },
  paymentIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  paymentTitle: { fontSize: 14, fontWeight: '700', color: '#000' },
  paymentAmount: { fontSize: 15, fontWeight: '800', color: '#AD9B8D', marginTop: 2 },
  paymentNote: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: '#000' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
  gcashBox: {
    backgroundColor: '#EDE9FE', borderRadius: 14, padding: 16, marginVertical: 12,
  },
  gcashTitle: { fontSize: 13, fontWeight: '800', color: '#5B21B6', marginBottom: 8 },
  gcashStep: { fontSize: 13, color: '#4C1D95', marginBottom: 4 },
  gcashNumber: { fontSize: 22, fontWeight: '900', color: '#5B21B6', textAlign: 'center', paddingVertical: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12,
  },
  uploadArea: {
    borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed',
    borderRadius: 14, overflow: 'hidden', marginBottom: 8, minHeight: 120,
    justifyContent: 'center', alignItems: 'center',
  },
  uploadPlaceholder: { alignItems: 'center', gap: 8, padding: 24 },
  uploadHint: { color: '#AD9B8D', fontSize: 13, fontWeight: '600' },
  proofPreview: { width: '100%', height: 180, resizeMode: 'cover' },
  removeProof: { alignItems: 'center', marginBottom: 12 },
  removeProofText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  cashBox: {
    backgroundColor: '#ECFDF5', borderRadius: 14, padding: 20,
    alignItems: 'center', gap: 8, marginVertical: 12,
  },
  cashTitle: { fontSize: 16, fontWeight: '800', color: '#065F46' },
  cashNote: { fontSize: 13, color: '#047857', textAlign: 'center', lineHeight: 20 },
  submitBtn: {
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
  },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  successContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12,
  },
  successTitle: { fontSize: 26, fontWeight: '900', color: '#000', marginTop: 8 },
  successSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  refText: { fontSize: 13, fontWeight: '700', color: '#AD9B8D', marginTop: 4 },
  doneBtn: {
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginTop: 20,
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
