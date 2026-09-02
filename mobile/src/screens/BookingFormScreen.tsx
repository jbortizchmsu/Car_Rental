import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, ActivityIndicator, Alert, SafeAreaView,
  KeyboardAvoidingView, Platform, Modal, FlatList, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, ChevronRight, Check, Calendar, MapPin,
  User, Navigation as NavIcon, AlertCircle, ShieldCheck,
  Upload, FileText, CheckCircle2, RotateCcw, X
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { bookingsApi, pricingApi, vehiclesApi } from '../services/api';

const formatApiDate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

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

const formatDateOnly = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatExpiryDisplay = (d: Date | null): string => {
  if (!d) return 'Select license expiry date...';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

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
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 20 },
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
  const [submitStatusText, setSubmitStatusText] = useState('');

  // Step 1: Schedule & Destination
  const [pickupDate, setPickupDate] = useState<Date>(new Date(Date.now() + 86400000));
  const [returnDate, setReturnDate] = useState<Date>(new Date(Date.now() + 2 * 86400000));
  const [pickupLocation, setPickupLocation] = useState('JD Car Rental Main Shop');
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [editingField, setEditingField] = useState<'pickup' | 'return' | null>(null);

  const [destinationName, setDestinationName] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationNotes, setDestinationNotes] = useState('');
  const [showMunicipalityPicker, setShowMunicipalityPicker] = useState(false);
  const [muniSearch, setMuniSearch] = useState('');

  // Step 1 Availability Validation State (Part A)
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityFailed, setAvailabilityFailed] = useState(false);

  // Step 2: Personal info
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<Date | null>(null);
  const [showLicenseExpiryPicker, setShowLicenseExpiryPicker] = useState(false);
  const licenseExpiry = licenseExpiryDate ? formatDateOnly(licenseExpiryDate) : '';
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Step 3: Documents (Part B)
  const [validIdAsset, setValidIdAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [licenseAsset, setLicenseAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // Full-size image preview modal state
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [viewingImageTitle, setViewingImageTitle] = useState<string | null>(null);

  // Field Validation State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Dynamic Pricing Quote State
  const [pricingQuote, setPricingQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

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

  // Fetch real pricing quote from backend when dates or vehicle change
  useEffect(() => {
    if (!vehicle?.id || !pickupDate || !returnDate) return;
    if (pickupDate >= returnDate) {
      setPricingQuote(null);
      return;
    }

    const timer = setTimeout(() => {
      setQuoteLoading(true);
      setQuoteError(null);
      pricingApi.getQuote({
        vehicleId: vehicle.id,
        startDate: formatApiDate(pickupDate),
        endDate: formatApiDate(returnDate),
      })
      .then(({ data }) => {
        setPricingQuote(data);
      })
      .catch((err: any) => {
        console.warn('[Pricing Quote Error]:', err?.response?.data || err?.message);
        setQuoteError('Using base estimate');
        setPricingQuote(null);
      })
      .finally(() => {
        setQuoteLoading(false);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [vehicle?.id, pickupDate, returnDate]);

  const days = pricingQuote?.rentalDays ?? calcDays(pickupDate, returnDate);
  const estimatedTotal = days * Number(vehicle.dailyRate);
  const displayTotal = pricingQuote?.totalPrice ?? estimatedTotal;

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
    // Reset availability error on date modification so stale errors are cleared
    setAvailabilityError(null);
    setAvailabilityFailed(false);
  };

  // ---- Document Image Picker ----
  const pickImage = async (docType: 'valid_id' | 'drivers_license') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        if (docType === 'valid_id') {
          setValidIdAsset(result.assets[0]);
        } else {
          setLicenseAsset(result.assets[0]);
        }
      }
    } catch (err) {
      Alert.alert('Permission Error', 'Failed to open image gallery. Please check camera roll permissions.');
    }
  };

  const getLocalStartOfToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  // ---- Step 1 Basic Validation ----
  const validateStep1Basic = () => {
    const errors: Record<string, string> = {};
    const now = getLocalStartOfToday();

    if (pickupDate < now) {
      Alert.alert('Invalid Date', 'Pickup date cannot be in the past.');
      return false;
    }
    if (returnDate <= pickupDate) {
      Alert.alert('Invalid Date', 'Return date must be after pickup date.');
      return false;
    }
    if (!pickupLocation.trim()) {
      errors.pickupLocation = 'Pickup location is required.';
    }
    if (!destinationName.trim()) {
      errors.destinationName = 'Please select your intended travel area.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  // ---- Step 1 Availability Check (Part A) ----
  const runAvailabilityCheck = async (): Promise<boolean> => {
    setCheckingAvailability(true);
    setAvailabilityError(null);
    setAvailabilityFailed(false);

    try {
      // 1. Check vehicle booked date ranges
      const bookedRes = await bookingsApi.getVehicleBookedDates(vehicle.id);
      const bookedRanges: Array<{ startDate: string; endDate: string }> = bookedRes.data || [];

      const start = pickupDate.getTime();
      const end = returnDate.getTime();

      const isOverlapping = bookedRanges.some(r => {
        const rStart = new Date(r.startDate).getTime();
        const rEnd = new Date(r.endDate).getTime();
        return start < rEnd && end > rStart;
      });

      if (isOverlapping) {
        setAvailabilityError('This vehicle is not available for the selected dates.');
        setCheckingAvailability(false);
        return false;
      }

      // 2. Check general available vehicles list for date range
      const availRes = await vehiclesApi.getAvailableWithDates(
        formatApiDate(pickupDate),
        formatApiDate(returnDate)
      );
      const availableList: any[] = availRes.data || [];
      const isAvailable = availableList.some(v => v.id === vehicle.id);

      if (!isAvailable) {
        setAvailabilityError('This vehicle is not available for the selected dates.');
        setCheckingAvailability(false);
        return false;
      }

      setCheckingAvailability(false);
      return true;
    } catch (err: any) {
      console.warn('[Availability Check Error]:', err?.message || err);
      setAvailabilityError('Failed to check vehicle availability. Please check your connection.');
      setAvailabilityFailed(true);
      setCheckingAvailability(false);
      return false;
    }
  };

  // ---- Step 2 Validation ----
  const validateStep2 = () => {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }

    if (!contactNumber.trim()) {
      errors.contactNumber = 'Contact number is required.';
    } else if (!/^09\d{9}$/.test(contactNumber.trim())) {
      errors.contactNumber = 'Contact number must be an 11-digit PH mobile number starting with 09 (e.g. 09171234567).';
    }

    if (!licenseNumber.trim()) {
      errors.licenseNumber = "Driver's license number is required.";
    } else if (licenseNumber.trim().length < 8) {
      errors.licenseNumber = "Please enter a valid driver's license number (at least 8 characters).";
    }

    if (!licenseExpiryDate) {
      errors.licenseExpiry = 'License expiry date is required.';
    } else if (licenseExpiryDate < getLocalStartOfToday()) {
      errors.licenseExpiry = "Your driver's license is expired.";
    }

    if (!address.trim()) {
      errors.address = 'Current address is required.';
    }

    if (!emergencyName.trim()) {
      errors.emergencyName = 'Emergency contact name is required.';
    }

    if (!emergencyPhone.trim()) {
      errors.emergencyPhone = 'Emergency contact phone is required.';
    } else if (!/^09\d{9}$/.test(emergencyPhone.trim())) {
      errors.emergencyPhone = 'Emergency contact phone must be an 11-digit PH mobile number starting with 09.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  // ---- Step 3 Validation ----
  const validateStep3 = () => {
    if (!validIdAsset) { Alert.alert('Required Document', 'Please upload a photo of your Valid ID.'); return false; }
    if (!licenseAsset) { Alert.alert('Required Document', "Please upload a photo of your Driver's License."); return false; }
    return true;
  };

  // ---- Navigation Handler ----
  const handleNext = async () => {
    if (step === 1) {
      if (!validateStep1Basic()) return;
      const available = await runAvailabilityCheck();
      if (!available) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!validateStep3()) return;
      setStep(4);
      return;
    }
    if (step === 4) {
      handleSubmit();
    }
  };

  // ---- Final Submission (Part B) ----
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitStatusText('Creating booking request...');
    let bookingId: string | null = null;

    try {
      const res = await bookingsApi.createBooking({
        vehicleId: vehicle.id,
        startDate: formatApiDate(pickupDate),
        endDate: formatApiDate(returnDate),
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
      bookingId = res.data.id;
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Booking submission failed. Please try again.';
      Alert.alert('Submission Failed', msg);
      setSubmitting(false);
      setSubmitStatusText('');
      return;
    }

    // Sequentially upload documents after booking creation
    let docUploadError = false;
    setSubmitStatusText('Uploading documents...');

    if (bookingId && validIdAsset) {
      try {
        const formData = new FormData();
        formData.append('type', 'valid_id');
        formData.append('bookingId', bookingId);
        // @ts-ignore
        formData.append('file', {
          uri: validIdAsset.uri,
          name: validIdAsset.fileName || `valid_id_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
        await bookingsApi.uploadDocument(bookingId, formData);
      } catch (err) {
        console.warn('Valid ID upload error:', err);
        docUploadError = true;
      }
    }

    if (bookingId && licenseAsset) {
      try {
        const formData = new FormData();
        formData.append('type', 'drivers_license');
        formData.append('bookingId', bookingId);
        // @ts-ignore
        formData.append('file', {
          uri: licenseAsset.uri,
          name: licenseAsset.fileName || `drivers_license_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
        await bookingsApi.uploadDocument(bookingId, formData);
      } catch (err) {
        console.warn('License upload error:', err);
        docUploadError = true;
      }
    }

    setSubmitting(false);
    setSubmitStatusText('');

    if (docUploadError) {
      Alert.alert(
        'Booking Created',
        'Your booking request was created, but document upload failed. You can upload your documents anytime from your Booking Details.',
        [{ text: 'OK', onPress: () => navigation.navigate('Bookings', { screen: 'BookingsList' }) }]
      );
    } else {
      Alert.alert(
        'Booking Submitted!',
        'Your booking request and documents have been sent. Please wait for admin review. You can track it in your Bookings tab.',
        [{ text: 'OK', onPress: () => navigation.navigate('Bookings', { screen: 'BookingsList' }) }]
      );
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
          onPress={() => {
            setFieldErrors({});
            step > 1 ? setStep(s => s - 1) : navigation.goBack();
          }}
          style={styles.backBtn}
          disabled={checkingAvailability || submitting}
        >
          <ChevronLeft size={24} stroke="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Book {vehicle.brand} {vehicle.model}</Text>
          <Text style={styles.headerSub}>Step {step} of 4</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <StepIndicator current={step} total={4} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ---- STEP 1: SCHEDULE & DESTINATION ---- */}
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Rental Schedule & Destination</Text>

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
              <View style={[styles.inputRow, fieldErrors.pickupLocation && styles.inputError]}>
                <MapPin size={16} stroke="#AD9B8D" />
                <TextInput
                  style={styles.inputInline}
                  value={pickupLocation}
                  onChangeText={(text) => {
                    setPickupLocation(text.slice(0, 100));
                    clearFieldError('pickupLocation');
                  }}
                  placeholder="Pickup location"
                  maxLength={100}
                />
              </View>
              {fieldErrors.pickupLocation ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.pickupLocation}</Text> : null}

              <Text style={styles.fieldLabel}>Intended Travel Area <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TouchableOpacity
                style={[styles.dateBtn, fieldErrors.destinationName && styles.inputError]}
                onPress={() => {
                  setShowMunicipalityPicker(true);
                  clearFieldError('destinationName');
                }}
              >
                <NavIcon size={18} stroke="#AD9B8D" />
                <Text style={[styles.dateBtnText, !destinationName && { color: '#9CA3AF' }]}>
                  {destinationName || 'Select municipality...'}
                </Text>
                <ChevronRight size={16} stroke="#9CA3AF" />
              </TouchableOpacity>
              {fieldErrors.destinationName ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.destinationName}</Text> : null}
              {destinationAddress ? (
                <Text style={styles.destHint}>{destinationAddress}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>Specific Landmark <Text style={{ color: '#9CA3AF', fontWeight: '400' }}>(Optional)</Text></Text>
              <TextInput
                style={[styles.input, fieldErrors.destinationAddress && styles.inputError]}
                value={destinationAddress}
                onChangeText={(text) => {
                  setDestinationAddress(text.slice(0, 100));
                  clearFieldError('destinationAddress');
                }}
                placeholder="e.g. Campuestohan Highland Resort"
                maxLength={100}
              />
              {fieldErrors.destinationAddress ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.destinationAddress}</Text> : null}

              <Text style={styles.fieldLabel}>Travel Notes <Text style={{ color: '#9CA3AF', fontWeight: '400' }}>(Optional)</Text></Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }, fieldErrors.destinationNotes && styles.inputError]}
                value={destinationNotes}
                onChangeText={(text) => {
                  setDestinationNotes(text.slice(0, 200));
                  clearFieldError('destinationNotes');
                }}
                placeholder="Any additional details about your trip..."
                multiline
                maxLength={200}
              />
              {fieldErrors.destinationNotes ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.destinationNotes}</Text> : null}

              {/* Inline Availability Error Box (Part A) */}
              {availabilityError && (
                <View style={styles.errorBox}>
                  <AlertCircle size={20} stroke="#EF4444" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.errorBoxTitle}>Availability Issue</Text>
                    <Text style={styles.errorBoxText}>{availabilityError}</Text>
                    {availabilityFailed && (
                      <TouchableOpacity style={styles.retryInlineBtn} onPress={handleNext}>
                        <Text style={styles.retryInlineText}>Retry Availability Check</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

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

              <Text style={styles.fieldLabel}>Full Name (as per ID) <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TextInput
                style={[styles.input, fieldErrors.fullName && styles.inputError]}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text.slice(0, 100));
                  clearFieldError('fullName');
                }}
                placeholder="Juan Dela Cruz"
                maxLength={100}
              />
              {fieldErrors.fullName ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.fullName}</Text> : null}

              <Text style={styles.fieldLabel}>Contact Number <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TextInput
                style={[styles.input, fieldErrors.contactNumber && styles.inputError]}
                value={contactNumber}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '').slice(0, 11);
                  setContactNumber(digits);
                  clearFieldError('contactNumber');
                }}
                placeholder="09XX XXX XXXX"
                keyboardType="phone-pad"
                maxLength={11}
              />
              {fieldErrors.contactNumber ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.contactNumber}</Text> : null}

              <Text style={styles.fieldLabel}>Current Address <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TextInput
                style={[styles.input, fieldErrors.address && styles.inputError]}
                value={address}
                onChangeText={(text) => {
                  setAddress(text.slice(0, 100));
                  clearFieldError('address');
                }}
                placeholder="Complete residential address"
                multiline
                numberOfLines={2}
                maxLength={100}
              />
              {fieldErrors.address ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.address}</Text> : null}

              <Text style={styles.sectionDivider}>Driver's License</Text>

              <Text style={styles.fieldLabel}>License Number <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TextInput
                style={[styles.input, fieldErrors.licenseNumber && styles.inputError]}
                value={licenseNumber}
                onChangeText={(text) => {
                  const cleaned = text.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 15);
                  setLicenseNumber(cleaned);
                  clearFieldError('licenseNumber');
                }}
                placeholder="e.g. N01-23-456789"
                autoCapitalize="characters"
                maxLength={15}
              />
              {fieldErrors.licenseNumber ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.licenseNumber}</Text> : null}

              <Text style={styles.fieldLabel}>License Expiry Date <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TouchableOpacity
                style={[styles.dateBtn, fieldErrors.licenseExpiry && styles.inputError]}
                onPress={() => {
                  setShowLicenseExpiryPicker(true);
                  clearFieldError('licenseExpiry');
                }}
              >
                <Calendar size={18} stroke="#AD9B8D" />
                <Text style={[styles.dateBtnText, !licenseExpiryDate && { color: '#9CA3AF' }]}>
                  {formatExpiryDisplay(licenseExpiryDate)}
                </Text>
                <ChevronRight size={16} stroke="#9CA3AF" />
              </TouchableOpacity>
              {fieldErrors.licenseExpiry ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.licenseExpiry}</Text> : null}

              {showLicenseExpiryPicker && (
                <DateTimePicker
                  value={licenseExpiryDate || new Date(Date.now() + 365 * 86400000)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={getLocalStartOfToday()}
                  onChange={(event: DateTimePickerEvent, selected?: Date) => {
                    setShowLicenseExpiryPicker(false);
                    if (selected && event.type !== 'dismissed') {
                      setLicenseExpiryDate(selected);
                      clearFieldError('licenseExpiry');
                    }
                  }}
                />
              )}

              <Text style={styles.sectionDivider}>Emergency Contact</Text>

              <Text style={styles.fieldLabel}>Emergency Contact Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TextInput
                style={[styles.input, fieldErrors.emergencyName && styles.inputError]}
                value={emergencyName}
                onChangeText={(text) => {
                  setEmergencyName(text.slice(0, 50));
                  clearFieldError('emergencyName');
                }}
                placeholder="Full name"
                maxLength={50}
              />
              {fieldErrors.emergencyName ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.emergencyName}</Text> : null}

              <Text style={styles.fieldLabel}>Emergency Contact Phone <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TextInput
                style={[styles.input, fieldErrors.emergencyPhone && styles.inputError]}
                value={emergencyPhone}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '').slice(0, 11);
                  setEmergencyPhone(digits);
                  clearFieldError('emergencyPhone');
                }}
                placeholder="09XX XXX XXXX"
                keyboardType="phone-pad"
                maxLength={11}
              />
              {fieldErrors.emergencyPhone ? <Text style={styles.fieldErrorText}>⚠ {fieldErrors.emergencyPhone}</Text> : null}
            </>
          )}

          {/* ---- STEP 3: DOCUMENTS (Part B) ---- */}
          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Required Documents</Text>

              <View style={styles.docNoticeBox}>
                <ShieldCheck size={22} stroke="#0284C7" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docNoticeTitle}>Document Verification</Text>
                  <Text style={styles.docNoticeText}>
                    Please upload clear photos of your Valid ID and Driver's License. Both are required before submitting your booking.
                  </Text>
                </View>
              </View>

              {/* 1. Valid ID */}
              <Text style={styles.fieldLabel}>1. Valid ID (Passport / Gov ID) <Text style={{ color: '#EF4444' }}>*</Text></Text>
              {validIdAsset ? (
                <View style={styles.uploadCardSelected}>
                  <TouchableOpacity
                    onPress={() => {
                      setViewingImageUri(validIdAsset.uri);
                      setViewingImageTitle('Valid ID');
                    }}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: validIdAsset.uri }} style={styles.uploadThumbnail} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={16} stroke="#10B981" />
                      <Text style={styles.uploadCardTitleSelected}>Valid ID Uploaded</Text>
                    </View>
                    <Text style={styles.uploadCardSubSelected} numberOfLines={1}>
                      {validIdAsset.fileName || 'valid_id.jpg'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.changeDocBtn} onPress={() => pickImage('valid_id')}>
                    <RotateCcw size={14} stroke="#374151" />
                    <Text style={styles.changeDocBtnText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeDocBtn} onPress={() => setValidIdAsset(null)}>
                    <X size={16} stroke="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadCardEmpty} onPress={() => pickImage('valid_id')}>
                  <View style={styles.uploadIconCircle}>
                    <Upload size={20} stroke="#AD9B8D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uploadCardTitle}>Upload Valid ID</Text>
                    <Text style={styles.uploadCardSub}>Passport, SSS, PhilHealth, etc. (Tap to browse)</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* 2. Driver's License */}
              <Text style={styles.fieldLabel}>2. Driver's License <Text style={{ color: '#EF4444' }}>*</Text></Text>
              {licenseAsset ? (
                <View style={styles.uploadCardSelected}>
                  <TouchableOpacity
                    onPress={() => {
                      setViewingImageUri(licenseAsset.uri);
                      setViewingImageTitle("Driver's License");
                    }}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: licenseAsset.uri }} style={styles.uploadThumbnail} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={16} stroke="#10B981" />
                      <Text style={styles.uploadCardTitleSelected}>Driver's License Uploaded</Text>
                    </View>
                    <Text style={styles.uploadCardSubSelected} numberOfLines={1}>
                      {licenseAsset.fileName || 'drivers_license.jpg'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.changeDocBtn} onPress={() => pickImage('drivers_license')}>
                    <RotateCcw size={14} stroke="#374151" />
                    <Text style={styles.changeDocBtnText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeDocBtn} onPress={() => setLicenseAsset(null)}>
                    <X size={16} stroke="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadCardEmpty} onPress={() => pickImage('drivers_license')}>
                  <View style={styles.uploadIconCircle}>
                    <Upload size={20} stroke="#AD9B8D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uploadCardTitle}>Upload Driver's License</Text>
                    <Text style={styles.uploadCardSub}>Must be valid and unexpired (Tap to browse)</Text>
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ---- STEP 4: REVIEW & SUBMIT ---- */}
          {step === 4 && (
            <>
              <Text style={styles.stepTitle}>Review & Submit</Text>

              {/* Booking summary */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Rental Summary</Text>
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
                  <Text style={styles.summaryLabel}>Pickup Location</Text>
                  <Text style={styles.summaryValue}>{pickupLocation}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Travel Area</Text>
                  <Text style={styles.summaryValue}>{destinationName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>{days} day{days !== 1 ? 's' : ''}</Text>
                </View>

                {pricingQuote?.multiplier > 1 && (
                  <View style={styles.ruleBadgeRow}>
                    <Text style={styles.ruleBadgeText}>
                      ⚡ {pricingQuote.appliedRuleName || 'Weekend Rate'} ({pricingQuote.multiplier}x multiplier)
                    </Text>
                  </View>
                )}

                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryLabel, { fontWeight: '800' }]}>Estimated Total</Text>
                    {quoteLoading ? (
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Calculating rate...</Text>
                    ) : !pricingQuote ? (
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Base estimate</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.summaryValue, { fontSize: 17, fontWeight: '900', color: '#000' }]}>
                    ₱{displayTotal.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* User details summary */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Customer Details</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Name</Text>
                  <Text style={styles.summaryValue}>{fullName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Contact</Text>
                  <Text style={styles.summaryValue}>{contactNumber}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>License No.</Text>
                  <Text style={styles.summaryValue}>{licenseNumber}</Text>
                </View>
              </View>

              {/* Uploaded documents summary */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Uploaded Documents</Text>
                <View style={styles.summaryDocRow}>
                  <Text style={styles.summaryLabel}>Valid ID</Text>
                  <View style={styles.summaryDocValueGroup}>
                    {validIdAsset?.uri ? (
                      <TouchableOpacity
                        onPress={() => {
                          setViewingImageUri(validIdAsset.uri);
                          setViewingImageTitle('Valid ID');
                        }}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: validIdAsset.uri }} style={styles.reviewThumbnail} />
                      </TouchableOpacity>
                    ) : null}
                    <CheckCircle2 size={14} stroke="#10B981" />
                    <Text style={styles.summaryDocText} numberOfLines={1}>
                      Attached
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryDocRow}>
                  <Text style={styles.summaryLabel}>Driver's License</Text>
                  <View style={styles.summaryDocValueGroup}>
                    {licenseAsset?.uri ? (
                      <TouchableOpacity
                        onPress={() => {
                          setViewingImageUri(licenseAsset.uri);
                          setViewingImageTitle("Driver's License");
                        }}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: licenseAsset.uri }} style={styles.reviewThumbnail} />
                      </TouchableOpacity>
                    ) : null}
                    <CheckCircle2 size={14} stroke="#10B981" />
                    <Text style={styles.summaryDocText} numberOfLines={1}>
                      Attached
                    </Text>
                  </View>
                </View>
              </View>

              {submitStatusText ? (
                <View style={styles.statusBox}>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={styles.statusBoxText}>{submitStatusText}</Text>
                </View>
              ) : null}
            </>
          )}

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.backNavBtn}
                onPress={() => {
                  setFieldErrors({});
                  setStep(s => s - 1);
                }}
                disabled={checkingAvailability || submitting}
              >
                <ChevronLeft size={18} stroke="#000" />
                <Text style={styles.backNavText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.nextBtn,
                (checkingAvailability || submitting) && { opacity: 0.6 },
                step === 1 && { flex: 1 }
              ]}
              onPress={handleNext}
              disabled={checkingAvailability || submitting}
            >
              {checkingAvailability || submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>{step === 4 ? 'Submit Booking' : 'Next'}</Text>
                  {step < 4 && <ChevronRight size={18} stroke="#FFF" />}
                </>
              )}
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
      {/* Full-screen Image Preview Modal */}
      <Modal
        visible={!!viewingImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImageUri(null)}
      >
        <TouchableOpacity
          style={styles.imagePreviewOverlay}
          activeOpacity={1}
          onPress={() => setViewingImageUri(null)}
        >
          <SafeAreaView style={styles.imagePreviewHeader}>
            <Text style={styles.imagePreviewTitle}>{viewingImageTitle || 'Document Preview'}</Text>
            <TouchableOpacity
              style={styles.imagePreviewCloseBtn}
              onPress={() => setViewingImageUri(null)}
            >
              <X size={22} stroke="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.imagePreviewBody}>
            {viewingImageUri ? (
              <Image
                source={{ uri: viewingImageUri }}
                style={styles.fullSizeImage}
                resizeMode="contain"
              />
            ) : null}
          </View>

          <Text style={styles.imagePreviewFooterHint}>Tap anywhere to close</Text>
        </TouchableOpacity>
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
  errorBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#FECACA', marginBottom: 14,
  },
  errorBoxTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B', marginBottom: 2 },
  errorBoxText: { fontSize: 13, color: '#B91C1C', lineHeight: 18 },
  retryInlineBtn: {
    marginTop: 8, backgroundColor: '#EF4444', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start',
  },
  retryInlineText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
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
  docNoticeBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#F0F9FF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 16,
  },
  docNoticeTitle: { fontSize: 14, fontWeight: '800', color: '#0369A1', marginBottom: 2 },
  docNoticeText: { fontSize: 12, color: '#0C4A6E', lineHeight: 18 },
  uploadCardEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E5E7EB', borderStyle: 'dashed', padding: 16, marginBottom: 14,
  },
  uploadIconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  uploadCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  uploadCardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  uploadCardSelected: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0FDF4', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#BBF7D0', padding: 14, marginBottom: 14,
  },
  uploadThumbnail: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#E5E7EB' },
  uploadCardTitleSelected: { fontSize: 14, fontWeight: '800', color: '#065F46' },
  uploadCardSubSelected: { fontSize: 12, color: '#047857', marginTop: 2 },
  changeDocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,
  },
  changeDocBtnText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  removeDocBtn: { padding: 6 },
  summaryBox: {
    backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 12,
  },
  summaryTitle: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#000', textAlign: 'right', flex: 1 },
  statusBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, marginTop: 12,
  },
  statusBoxText: { fontSize: 13, fontWeight: '700', color: '#374151' },
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
  ruleBadgeRow: {
    backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#FFEDD5', marginVertical: 6,
  },
  ruleBadgeText: { fontSize: 12, fontWeight: '700', color: '#C2410C' },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'space-between',
  },
  imagePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
  },
  imagePreviewTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  imagePreviewCloseBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  imagePreviewBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  fullSizeImage: {
    width: '100%',
    height: '100%',
  },
  imagePreviewFooterHint: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 24,
  },
  summaryDocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryDocValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  reviewThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  summaryDocText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 6,
  },
});
