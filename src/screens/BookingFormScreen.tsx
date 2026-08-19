import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, ActivityIndicator, Alert, SafeAreaView,
  KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { ChevronLeft, ChevronRight, Check, Calendar, MapPin, User, Navigation as NavIcon, AlertCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { bookingsApi } from '../services/api';

// ---- Negros Island Municipalities ----
const NEGROS_OCC = [
  'Bacolod', 'Bago', 'Cadiz', 'Escalante', 'Himamaylan', 'Kabankalan',
  'La Carlota', 'Sagay', 'San Carlos', 'Silay', 'Talisay', 'Victorias',
  'Binalbagan', 'Calatrava', 'Candoni', 'Cauayan', 'Enrique B. Magalona',
  'Hinigaran', 'Hinoba-an', 'Ilog', 'Isabela', 'La Castellana', 'Manapla',
  'Moises Padilla', 'Murcia', 'Pontevedra', 'Pulupandan', 'Salvador Benedicto',
  'San Enrique', 'Sipalay', 'Toboso', 'Valladolid',
];
const NEGROS_OR = [
  'Bayawan', 'Bais', 'Canlaon', 'Dumaguete', 'Guihulngan', 'Tanjay',
  'Amlan', 'Ayungon', 'Bacong', 'Basay', 'Bindoy', 'Dauin', 'Jimalalud',
  'La Libertad', 'Mabinay', 'Manjuyod', 'Pamplona', 'San Jose',
  'Santa Catalina', 'Siaton', 'Sibulan', 'Tayasan', 'Valencia',
  'Vallehermoso', 'Zamboanguita',
];
const ALL_MUNICIPALITIES = [
  ...NEGROS_OCC.map(m => ({ label: m, group: 'Negros Occidental' })),
  ...NEGROS_OR.map(m => ({ label: m, group: 'Negros Oriental' })),
];

// ---- Date helpers ----
const formatDisplay = (d: Date) =>
  d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatDateOnly = (d: Date) =>
  d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

const calcDays = (start: Date, end: Date) => {
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// ---- Step indicator ----
const StepIndicator = ({ current, total }: { current: number; total: number }) => (
  <View style={stepStyles.container}>
    {Array.from({ length: total }, (_, i) => (
      <React.Fragment key={i}>
        <View style={[stepStyles.circle, i + 1 <= current && stepStyles.circleActive]}>
          {i + 1 < current
            ? <Check size={14} stroke="#FFF" />
            : <Text style={[stepStyles.num, i + 1 <= current && stepStyles.numActive]}>{i + 1}</Text>
          }
        </View>
        {i < total - 1 && (
          <View style={[stepStyles.line, i + 1 < current && stepStyles.lineActive]} />
        )}
      </React.Fragment>
    ))}
  </View>
);

const stepStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  circle: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB',
  },
  circleActive: { borderColor: '#000', backgroundColor: '#000' },
  num: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  numActive: { color: '#FFF' },
  line: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  lineActive: { backgroundColor: '#000' },
});

// ---- Main component ----
export default function BookingFormScreen({ route, navigation }: any) {
  const { vehicle } = route.params;
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Schedule
  const [pickupDate, setPickupDate] = useState<Date>(new Date(Date.now() + 86400000));
  const [returnDate, setReturnDate] = useState<Date>(new Date(Date.now() + 2 * 86400000));
  const [pickupLocation, setPickupLocation] = useState('JD Car Rental Main Shop');
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [editingField, setEditingField] = useState<'pickup' | 'return' | null>(null);

  // Step 2: Personal info
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Step 3: Destination
  const [destinationName, setDestinationName] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationNotes, setDestinationNotes] = useState('');
  const [showMunicipalityPicker, setShowMunicipalityPicker] = useState(false);
  const [muniSearch, setMuniSearch] = useState('');

  // Pre-fill user data
  useEffect(() => {
    AsyncStorage.getItem('jd_user').then(val => {
      if (val) {
        const user = JSON.parse(val);
        setFullName(user.fullName || '');
        setContactNumber(user.phoneNumber || '');
        setAddress(user.address || '');
      }
    });
  }, []);

  const days = calcDays(pickupDate, returnDate);
  const estimatedTotal = days * Number(vehicle.dailyRate);

  // ---- Android two-step date+time picker ----
  const openDatePicker = (field: 'pickup' | 'return') => {
    setEditingField(field);
    setTempDate(field === 'pickup' ? pickupDate : returnDate);
    setPickerMode('date');
    if (field === 'pickup') setShowPickupPicker(true);
    else setShowReturnPicker(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!selected || event.type === 'dismissed') {
      setShowPickupPicker(false);
      setShowReturnPicker(false);
      setEditingField(null);
      return;
    }
    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        setTempDate(selected);
        setPickerMode('time');
      } else {
        // Combine date from tempDate + time from selected
        const combined = new Date(tempDate);
        combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        applyDate(combined);
        setShowPickupPicker(false);
        setShowReturnPicker(false);
        setEditingField(null);
        setPickerMode('date');
      }
    } else {
      applyDate(selected);
    }
  };

  const applyDate = (date: Date) => {
    if (editingField === 'pickup') setPickupDate(date);
    else setReturnDate(date);
  };

  // ---- Validation ----
  const validateStep1 = () => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (pickupDate < now) { Alert.alert('Invalid Date', 'Pickup date cannot be in the past.'); return false; }
    if (returnDate <= pickupDate) { Alert.alert('Invalid Date', 'Return date must be after pickup date.'); return false; }
    if (!pickupLocation.trim()) { Alert.alert('Required', 'Please enter a pickup location.'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!fullName.trim()) { Alert.alert('Required', 'Full name is required.'); return false; }
    if (!contactNumber.trim()) { Alert.alert('Required', 'Contact number is required.'); return false; }
    if (!licenseNumber.trim()) { Alert.alert('Required', "Driver's license number is required."); return false; }
    if (!licenseExpiry.trim()) { Alert.alert('Required', "License expiry date is required."); return false; }
    if (new Date(licenseExpiry) < new Date()) { Alert.alert('Expired', "Your driver's license is expired."); return false; }
    if (!address.trim()) { Alert.alert('Required', 'Address is required.'); return false; }
    if (!emergencyName.trim()) { Alert.alert('Required', 'Emergency contact name is required.'); return false; }
    if (!emergencyPhone.trim()) { Alert.alert('Required', 'Emergency contact phone is required.'); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!destinationName.trim()) { Alert.alert('Required', 'Please select your intended travel area.'); return false; }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    if (step < 3) { setStep(s => s + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await bookingsApi.createBooking({
        vehicleId: vehicle.id,
        startDate: pickupDate.toISOString(),
        endDate: returnDate.toISOString(),
        pickupLocation: pickupLocation.trim(),
        destinationName: destinationName.trim(),
        destinationAddress: destinationAddress.trim(),
        destinationNotes: destinationNotes.trim(),
        fullName: fullName.trim(),
        contactNumber: contactNumber.trim(),
        address: address.trim(),
        licenseNumber: licenseNumber.trim(),
        licenseExpiry: licenseExpiry.trim(),
        emergencyContact: emergencyName.trim(),
        emergencyPhone: emergencyPhone.trim(),
      });
      Alert.alert(
        'Booking Submitted!',
        'Your booking request has been sent. Please wait for admin review. You can track it in your Bookings tab.',
        [{ text: 'OK', onPress: () => navigation.navigate('BookingsList') }]
      );
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Booking submission failed. Please try again.';
      Alert.alert('Submission Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMuni = ALL_MUNICIPALITIES.filter(m =>
    !muniSearch || m.label.toLowerCase().includes(muniSearch.toLowerCase())
  );

  // ---- Render ----
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => step > 1 ? setStep(s => s - 1) : navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} stroke="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Book {vehicle.brand} {vehicle.model}</Text>
          <Text style={styles.headerSub}>Step {step} of 3</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <StepIndicator current={step} total={3} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ---- STEP 1: SCHEDULE ---- */}
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Rental Schedule</Text>

              {/* Estimated cost banner */}
              <View style={styles.costBanner}>
                <Text style={styles.costLabel}>{days} day{days !== 1 ? 's' : ''} × ₱{Number(vehicle.dailyRate).toLocaleString()}</Text>
                <Text style={styles.costValue}>≈ ₱{estimatedTotal.toLocaleString()}</Text>
              </View>

              <Text style={styles.fieldLabel}>Pickup Date & Time</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => openDatePicker('pickup')}>
                <Calendar size={18} stroke="#AD9B8D" />
                <Text style={styles.dateBtnText}>{formatDisplay(pickupDate)}</Text>
                <ChevronRight size={16} stroke="#9CA3AF" />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Return Date & Time</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => openDatePicker('return')}>
                <Calendar size={18} stroke="#AD9B8D" />
                <Text style={styles.dateBtnText}>{formatDisplay(returnDate)}</Text>
                <ChevronRight size={16} stroke="#9CA3AF" />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Pickup Location</Text>
              <View style={styles.inputRow}>
                <MapPin size={16} stroke="#AD9B8D" />
                <TextInput
                  style={styles.inputInline}
                  value={pickupLocation}
                  onChangeText={setPickupLocation}
                  placeholder="Pickup location"
                />
              </View>

              <View style={styles.infoBox}>
                <AlertCircle size={14} stroke="#958786" />
                <Text style={styles.infoText}>
                  GPS tracking activates automatically when the admin releases the vehicle.
                </Text>
              </View>

              {(showPickupPicker || showReturnPicker) && (
                <DateTimePicker
                  value={Platform.OS === 'android' && pickerMode === 'time' ? tempDate : (editingField === 'pickup' ? pickupDate : returnDate)}
                  mode={Platform.OS === 'android' ? pickerMode : 'datetime'}
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={editingField === 'return' ? pickupDate : new Date()}
                  onChange={handleDateChange}
                />
              )}
            </>
          )}

          {/* ---- STEP 2: PERSONAL INFO ---- */}
          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Your Information</Text>

              <Text style={styles.fieldLabel}>Full Name (as per ID)</Text>
              <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Juan Dela Cruz" />

              <Text style={styles.fieldLabel}>Contact Number</Text>
              <TextInput style={styles.input} value={contactNumber} onChangeText={setContactNumber} placeholder="09XX XXX XXXX" keyboardType="phone-pad" />

              <Text style={styles.fieldLabel}>Current Address</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Complete residential address" multiline numberOfLines={2} />

              <Text style={styles.sectionDivider}>Driver's License</Text>

              <Text style={styles.fieldLabel}>License Number</Text>
              <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="e.g. N01-23-456789" autoCapitalize="characters" />

              <Text style={styles.fieldLabel}>License Expiry Date</Text>
              <TextInput style={styles.input} value={licenseExpiry} onChangeText={setLicenseExpiry} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />

              <Text style={styles.sectionDivider}>Emergency Contact</Text>

              <Text style={styles.fieldLabel}>Emergency Contact Name</Text>
              <TextInput style={styles.input} value={emergencyName} onChangeText={setEmergencyName} placeholder="Full name" />

              <Text style={styles.fieldLabel}>Emergency Contact Phone</Text>
              <TextInput style={styles.input} value={emergencyPhone} onChangeText={setEmergencyPhone} placeholder="09XX XXX XXXX" keyboardType="phone-pad" />
            </>
          )}

          {/* ---- STEP 3: DESTINATION + REVIEW ---- */}
          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Destination & Review</Text>

              <Text style={styles.fieldLabel}>Intended Travel Area <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowMunicipalityPicker(true)}>
                <NavIcon size={18} stroke="#AD9B8D" />
                <Text style={[styles.dateBtnText, !destinationName && { color: '#9CA3AF' }]}>
                  {destinationName || 'Select municipality...'}
                </Text>
                <ChevronRight size={16} stroke="#9CA3AF" />
              </TouchableOpacity>
              {destinationAddress ? (
                <Text style={styles.destHint}>{destinationAddress}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>Specific Landmark <Text style={{ color: '#9CA3AF', fontWeight: '400' }}>(Optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={destinationAddress}
                onChangeText={setDestinationAddress}
                placeholder="e.g. Campuestohan Highland Resort"
              />

              <Text style={styles.fieldLabel}>Travel Notes <Text style={{ color: '#9CA3AF', fontWeight: '400' }}>(Optional)</Text></Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={destinationNotes}
                onChangeText={setDestinationNotes}
                placeholder="Any additional details about your trip..."
                multiline
              />

              {/* Booking summary */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Booking Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Vehicle</Text>
                  <Text style={styles.summaryValue}>{vehicle.brand} {vehicle.model}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Pickup</Text>
                  <Text style={styles.summaryValue}>{formatDisplay(pickupDate)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Return</Text>
                  <Text style={styles.summaryValue}>{formatDisplay(returnDate)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>{days} day{days !== 1 ? 's' : ''}</Text>
                </View>
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4 }]}>
                  <Text style={[styles.summaryLabel, { fontWeight: '800' }]}>Estimated Total</Text>
                  <Text style={[styles.summaryValue, { fontSize: 17, fontWeight: '900', color: '#000' }]}>
                    ₱{estimatedTotal.toLocaleString()}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {step > 1 && (
              <TouchableOpacity style={styles.backNavBtn} onPress={() => setStep(s => s - 1)}>
                <ChevronLeft size={18} stroke="#000" />
                <Text style={styles.backNavText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.nextBtn, submitting && { opacity: 0.6 }, step === 1 && { flex: 1 }]}
              onPress={handleNext}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#FFF" size="small" />
                : <>
                    <Text style={styles.nextBtnText}>{step === 3 ? 'Submit Booking' : 'Next'}</Text>
                    {step < 3 && <ChevronRight size={18} stroke="#FFF" />}
                  </>
              }
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Municipality picker modal */}
      <Modal visible={showMunicipalityPicker} animationType="slide" transparent>
        <View style={styles.muniOverlay}>
          <View style={styles.muniSheet}>
            <View style={styles.muniHeader}>
              <Text style={styles.muniTitle}>Select Municipality</Text>
              <TouchableOpacity onPress={() => { setShowMunicipalityPicker(false); setMuniSearch(''); }}>
                <Text style={styles.muniClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.muniSearch}>
              <TextInput
                style={styles.muniSearchInput}
                placeholder="Search municipalities..."
                value={muniSearch}
                onChangeText={setMuniSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredMuni}
              keyExtractor={item => item.label}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.muniItem, destinationName === item.label && styles.muniItemSelected]}
                  onPress={() => {
                    setDestinationName(item.label);
                    setDestinationAddress(`${item.label}, ${item.group}, Negros Island, Philippines`);
                    setShowMunicipalityPicker(false);
                    setMuniSearch('');
                  }}
                >
                  <Text style={[styles.muniItemText, destinationName === item.label && { color: '#FFF' }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.muniGroup, destinationName === item.label && { color: 'rgba(255,255,255,0.7)' }]}>
                    {item.group}
                  </Text>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
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
    flexDirection: 'row', alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  headerSub: { color: '#AD9B8D', fontSize: 11, fontWeight: '600', marginTop: 2 },
  backBtn: { width: 40 },
  scroll: { padding: 16 },
  stepTitle: { fontSize: 20, fontWeight: '900', color: '#000', marginBottom: 16 },
  costBanner: {
    backgroundColor: '#F0FDF4', borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0',
  },
  costLabel: { fontSize: 13, color: '#065F46', fontWeight: '600' },
  costValue: { fontSize: 20, fontWeight: '900', color: '#065F46' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 2 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
    padding: 14, marginBottom: 12,
  },
  dateBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#000' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14, marginBottom: 12,
  },
  inputInline: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#000' },
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginTop: 4,
  },
  infoText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },
  input: {
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, color: '#000',
  },
  sectionDivider: {
    fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 8, marginBottom: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  destHint: { fontSize: 11, color: '#AD9B8D', marginTop: -8, marginBottom: 8, marginLeft: 4 },
  summaryBox: {
    backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 12,
  },
  summaryTitle: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#000', textAlign: 'right', flex: 1 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  backNavBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 18,
  },
  backNavText: { fontSize: 15, fontWeight: '700', color: '#000' },
  nextBtn: {
    flex: 1, backgroundColor: '#000', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  muniOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  muniSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  muniHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  muniTitle: { fontSize: 17, fontWeight: '800' },
  muniClose: { color: '#AD9B8D', fontSize: 15, fontWeight: '700' },
  muniSearch: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  muniSearchInput: {
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  muniItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  muniItemSelected: { backgroundColor: '#000' },
  muniItemText: { fontSize: 15, fontWeight: '600', color: '#000' },
  muniGroup: { fontSize: 11, color: '#9CA3AF' },
});
