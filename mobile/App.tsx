import 'react-native-gesture-handler';
import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView, RefreshControl, Image,
  Modal, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Car, MapPin, AlertCircle, CheckCircle2, Navigation as NavIcon, Calendar, RefreshCw, Bell, User, FileText, Upload, ChevronRight, X, Eye, EyeOff } from 'lucide-react-native';
import api, { authApi, bookingsApi, gpsApi, notificationsApi, customerApi } from './src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// New screen imports
import BookingsListScreen from './src/screens/BookingsListScreen';
import BookingDetailScreen from './src/screens/BookingDetailScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import VehiclesScreen from './src/screens/VehiclesScreen';
import BookingFormScreen from './src/screens/BookingFormScreen';
import { bookingFormStatus } from './src/services/bookingState';

// --- Login Screen (unchanged) ---
const LoginScreen = ({ onLogin }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      const { token, user } = response.data;
      await AsyncStorage.setItem('jd_token', token);
      await AsyncStorage.setItem('jd_user', JSON.stringify(user));
      onLogin(user);
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        Alert.alert('Login Failed', 'Server is taking too long to respond.');
      } else if (!error.response) {
        Alert.alert('Login Failed', 'Cannot connect to server. Check API URL and backend.');
      } else if (error.response.status === 401) {
        Alert.alert('Login Failed', 'Invalid email or password.');
      } else {
        Alert.alert('Login Failed', error.response?.data?.error || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.loginScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <Car size={64} stroke="#AD9B8D" />
              <Text style={styles.title}>JD CAR RENTAL</Text>
              <Text style={styles.subtitle}>Premium Self-Drive Experience</Text>
              <View style={styles.form}>
                <TextInput
                  onChangeText={setEmail} value={email}
                  placeholder="email@address.com" autoCapitalize="none"
                  style={styles.input} keyboardType="email-address"
                />
                <View style={styles.passwordContainer}>
                  <TextInput
                    onChangeText={setPassword} value={password}
                    secureTextEntry={!showPassword} placeholder="Password"
                    autoCapitalize="none" style={styles.passwordInput}
                  />
                  <TouchableOpacity style={styles.showPasswordBtn} onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={20} stroke="#958786" /> : <Eye size={20} stroke="#958786" />}
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.button} disabled={loading} onPress={signInWithEmail}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Login</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Home (Active Rental + GPS) Screen (unchanged) ---
const HomeScreen = () => {
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [lastLocation, setLastLocation] = useState<any>(null);
  const [trackingSession, setTrackingSession] = useState<any>(null);

  const fetchActiveBooking = async () => {
    try {
      const response = await customerApi.getActiveRental();
      if (response.data && response.data.data) {
        setActiveBooking(response.data.data);
        const session = response.data.meta?.trackingSessionId
          ? { id: response.data.meta.trackingSessionId }
          : null;
        setTrackingSession(session);
      } else {
        setActiveBooking(null);
        setTrackingSession(null);
      }
    } catch (error: any) {
      console.error('Fetch Booking Error:', error.message || 'Unknown error');
      Alert.alert('Connection Error', 'Unable to check active rental. Please check server connection.');
      setActiveBooking(null);
      setTrackingSession(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let locationSubscription: any = null;
    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status === 'granted');
        if (status === 'granted' && activeBooking && trackingSession) {
          setTrackingActive(true);
          locationSubscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 30 },
            async (location) => {
              setLastLocation(location);
              try {
                await gpsApi.sendLocation({
                  trackingSessionId: trackingSession.id,
                  bookingId: activeBooking.id,
                  vehicleId: activeBooking.vehicleId,
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  speed: location.coords.speed,
                  heading: location.coords.heading,
                  accuracy: location.coords.accuracy,
                  recordedAt: new Date(location.timestamp).toISOString(),
                });
              } catch (err) {
                console.error('GPS Upload Error:', err);
              }
            }
          );
        } else {
          setTrackingActive(false);
        }
      } catch (err) {
        console.error('Location Setup Error:', err);
      }
    };
    startTracking();
    return () => locationSubscription?.remove();
  }, [activeBooking, trackingSession]);

  useEffect(() => {
    fetchActiveBooking();
    const interval = setInterval(fetchActiveBooking, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>JD Active Drive</Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, loading && { flexGrow: 1 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchActiveBooking(); }} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#AD9B8D" />
          </View>
        ) : activeBooking ? (
          <View style={{ width: '100%' }}>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <View>
                  <Text style={styles.cardTitle}>{activeBooking.vehicle.brand} {activeBooking.vehicle.model}</Text>
                  <Text style={styles.cardSubtitle}>{activeBooking.vehicle.licensePlate}</Text>
                </View>
                <NavIcon size={24} stroke="#7B1FA2" />
              </View>
              <View style={styles.detailRow}>
                <Calendar size={16} stroke="#958786" />
                <Text style={styles.detailText}>Ends: {new Date(activeBooking.endDate).toLocaleDateString()}</Text>
              </View>
              <View style={styles.detailRow}>
                <MapPin size={18} stroke="#AD9B8D" />
                <Text style={styles.detailText}>Pickup: {activeBooking.pickupLocation}</Text>
              </View>
            </View>

            <View style={[styles.trackingContainer, { backgroundColor: trackingActive ? '#F3E5F5' : '#F9FAFB' }]}>
              {trackingActive ? (
                <>
                  <NavIcon size={32} stroke="#7B1FA2" />
                  <Text style={[styles.trackingText, { color: '#7B1FA2' }]}>GPS tracking active</Text>
                  {lastLocation ? (
                    <View style={{ marginTop: 10, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <RefreshCw size={12} stroke="#7B1FA2" />
                        <Text style={{ color: '#7B1FA2', fontSize: 12, fontWeight: '600' }}>
                          Updated {new Date(lastLocation.timestamp).toLocaleTimeString()}
                        </Text>
                      </View>
                      <Text style={{ color: '#958786', fontSize: 11, marginTop: 4 }}>
                        {lastLocation.coords.latitude.toFixed(6)}, {lastLocation.coords.longitude.toFixed(6)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: '#958786', fontSize: 12, marginTop: 10 }}>Getting your GPS location...</Text>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle size={32} stroke="#958786" />
                  <Text style={styles.trackingText}>
                    {locationPermission === false ? 'Permission Denied' : 'Waiting for vehicle release'}
                  </Text>
                  <Text style={styles.trackingSubtext}>
                    {locationPermission === false
                      ? 'Location permission is required for active rentals.'
                      : 'GPS tracking will start automatically once the admin releases the vehicle.'}
                  </Text>
                </>
              )}
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Car size={64} stroke="#DDD" />
            <Text style={[styles.title, { fontSize: 24 }]}>No active rental yet</Text>
            <Text style={styles.subtitle}>GPS starts after vehicle release.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Notifications Screen (unchanged) ---
const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const response = await notificationsApi.getNotifications();
      setNotifications(response.data);
    } catch (error) {
      console.error('Fetch Notifications Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Read Error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={async () => { await notificationsApi.markAllAsRead(); fetchNotifications(); }}>
          <Text style={{ color: '#FFF', fontSize: 12 }}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          { padding: 0 },
          (loading || notifications.length === 0) && { flexGrow: 1 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#AD9B8D" />
          </View>
        ) : notifications.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 100 }}>
            <Bell size={64} stroke="#DDD" />
            <Text style={styles.subtitle}>No notifications yet.</Text>
          </View>
        ) : (
          notifications.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[styles.notificationItem, { backgroundColor: n.isRead ? '#FFF' : '#F3E5F5' }]}
              onPress={() => !n.isRead && markAsRead(n.id)}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.notifIcon, { backgroundColor: n.isRead ? '#F3F4F6' : '#7B1FA2' }]}>
                  <Bell size={18} stroke={n.isRead ? '#9CA3AF' : '#FFF'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifTitle, { fontWeight: n.isRead ? '600' : '800' }]}>{n.title}</Text>
                  <Text style={styles.notifMessage}>{n.message}</Text>
                  <Text style={styles.notifTime}>{new Date(n.createdAt).toLocaleString()}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Profile Screen (unchanged) ---
const ProfileScreen = ({ onLogout }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('jd_user').then(val => {
      if (val) setUser(JSON.parse(val));
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('jd_token');
    await AsyncStorage.removeItem('jd_user');
    onLogout();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <View style={{ flex: 1, width: '100%' }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#AD9B8D" />
          </View>
        ) : (
          <View style={{ flex: 1, padding: 20, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#AD9B8D', justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
              <User size={40} stroke="#FFF" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800' }}>{user?.fullName || 'JD Customer'}</Text>
            <Text style={{ color: '#958786', marginBottom: 30 }}>{user?.email}</Text>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#EF4444' }]} onPress={handleLogout}>
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

// --- Navigation stacks ---
const BookingStackNav = createStackNavigator();
const BookingsStackNavigator = () => (
  <BookingStackNav.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: '#FDFDFD' } }}>
    <BookingStackNav.Screen name="BookingsList" component={BookingsListScreen} />
    <BookingStackNav.Screen name="BookingDetail" component={BookingDetailScreen} />
    <BookingStackNav.Screen name="PaymentSubmit" component={PaymentScreen} />
  </BookingStackNav.Navigator>
);

const VehicleStackNav = createStackNavigator();
const VehiclesStackNavigator = () => (
  <VehicleStackNav.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: '#FDFDFD' } }}>
    <VehicleStackNav.Screen name="VehiclesList" component={VehiclesScreen} />
    <VehicleStackNav.Screen name="BookingForm" component={BookingFormScreen} />
  </VehicleStackNav.Navigator>
);

const Tab = createBottomTabNavigator();
const AuthStack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('jd_user');
      setUser(storedUser ? JSON.parse(storedUser) : null);
    } catch (e) {
      console.error('Session check error', e);
      setUser(null);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#AD9B8D" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {user ? (
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              sceneContainerStyle: { backgroundColor: '#FDFDFD' },
              tabBarIcon: ({ focused, color, size }) => {
                if (route.name === 'Home') return <Car size={size} stroke={color} />;
                if (route.name === 'Book') return <Calendar size={size} stroke={color} />;
                if (route.name === 'Bookings') return <FileText size={size} stroke={color} />;
                if (route.name === 'Alerts') return <Bell size={size} stroke={color} />;
                if (route.name === 'Profile') return <User size={size} stroke={color} />;
                return null;
              },
              tabBarActiveTintColor: '#AD9B8D',
              tabBarInactiveTintColor: '#958786',
              tabBarStyle: { height: 60, paddingBottom: 10 },
            })}
          >
            <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Active' }} />
            <Tab.Screen
              name="Book"
              component={VehiclesStackNavigator}
              options={{ tabBarLabel: 'Book' }}
              listeners={({ navigation }) => ({
                tabPress: () => {
                  if (!bookingFormStatus.hasInProgress) {
                    navigation.navigate('Book', { screen: 'VehiclesList' });
                  }
                },
              })}
            />
            <Tab.Screen name="Bookings" component={BookingsStackNavigator} options={{ tabBarLabel: 'Bookings' }} />
            <Tab.Screen name="Alerts" component={NotificationsScreen} options={{ tabBarLabel: 'Alerts' }} />
            <Tab.Screen
              name="Profile"
              options={{ tabBarLabel: 'Profile' }}
            >
              {(props) => <ProfileScreen {...props} onLogout={() => setUser(null)} />}
            </Tab.Screen>
          </Tab.Navigator>
        ) : (
          <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLogin={(u: any) => setUser(u)} />}
            </AuthStack.Screen>
          </AuthStack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFDFD' },
  center: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', padding: 40 },
  scrollContent: { padding: 20, alignItems: 'center' },
  loginScrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#000', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  title: { fontSize: 32, fontWeight: '800', marginTop: 20, color: '#000', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#958786', marginBottom: 40, textAlign: 'center' },
  form: { width: '100%', marginBottom: 20 },
  input: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#DDD', marginBottom: 15, fontSize: 16 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#DDD', marginBottom: 15 },
  passwordInput: { flex: 1, padding: 15, fontSize: 16 },
  showPasswordBtn: { padding: 15, justifyContent: 'center', alignItems: 'center' },
  button: { backgroundColor: '#AD9B8D', paddingVertical: 15, paddingHorizontal: 60, borderRadius: 12, width: '100%', alignItems: 'center', height: 55, justifyContent: 'center' },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 3, marginBottom: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  cardSubtitle: { color: '#958786', fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  detailText: { fontSize: 14, color: '#6B7280' },
  trackingContainer: { alignItems: 'center', marginTop: 20, padding: 25, backgroundColor: '#F9FAFB', borderRadius: 24, width: '100%' },
  trackingText: { fontSize: 18, fontWeight: '700', marginTop: 12, color: '#374151' },
  trackingSubtext: { textAlign: 'center', color: '#958786', marginTop: 8, lineHeight: 20, fontSize: 14 },
  notificationItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  notifIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  notifTitle: { fontSize: 15, color: '#000', marginBottom: 2 },
  notifMessage: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  notifTime: { fontSize: 11, color: '#9CA3AF' },
});
