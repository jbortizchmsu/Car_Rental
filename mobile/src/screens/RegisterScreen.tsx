import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView,
  TouchableWithoutFeedback, Keyboard, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Car, Eye, EyeOff } from 'lucide-react-native';
import { authApi } from '../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// First-line UX validation only — the backend's zod schema (registerSchema, added
// earlier this session) is the real authority and is re-checked server-side regardless
// of what passes here.
const RegisterScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !address.trim() || !password || !confirmPassword) {
      Alert.alert('Missing information', 'Please fill in all fields.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please make sure both password fields match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        email: email.trim(),
        password,
        confirmPassword,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
      });

      Alert.alert(
        'Registration successful!',
        'Please check your email to verify your account before logging in.',
        [{ text: 'Back to Login', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: any) {
      // Surface the backend's actual error (e.g. "Email already registered", or the
      // zod validation message) rather than a generic message — matches web's
      // err.response?.data?.error pattern in RegisterPage.tsx.
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        Alert.alert('Registration Failed', 'Server is taking too long to respond.');
      } else if (!error.response) {
        Alert.alert('Registration Failed', 'Cannot connect to server. Check your connection and try again.');
      } else {
        Alert.alert('Registration Failed', error.response?.data?.error || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <Car size={56} stroke="#AD9B8D" />
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join us for premium self-drive rentals</Text>

              <View style={styles.form}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  onChangeText={setFullName} value={fullName}
                  placeholder="Juan Dela Cruz" placeholderTextColor="#958786"
                  style={styles.input}
                />

                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  onChangeText={setEmail} value={email}
                  placeholder="juan@example.com" placeholderTextColor="#958786"
                  autoCapitalize="none" keyboardType="email-address"
                  style={styles.input}
                />

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  onChangeText={(t) => setPhoneNumber(t.replace(/\D/g, '').slice(0, 11))}
                  value={phoneNumber}
                  placeholder="09123456789" placeholderTextColor="#958786"
                  keyboardType="number-pad" maxLength={11}
                  style={styles.input}
                />

                <Text style={styles.label}>Address</Text>
                <TextInput
                  onChangeText={setAddress} value={address}
                  placeholder="City, Province" placeholderTextColor="#958786"
                  style={styles.input}
                />

                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    onChangeText={setPassword} value={password}
                    secureTextEntry={!showPassword} placeholder="Password"
                    placeholderTextColor="#958786" autoCapitalize="none"
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity style={styles.showPasswordBtn} onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={20} stroke="#958786" /> : <Eye size={20} stroke="#958786" />}
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    onChangeText={setConfirmPassword} value={confirmPassword}
                    secureTextEntry={!showConfirmPassword} placeholder="Confirm password"
                    placeholderTextColor="#958786" autoCapitalize="none"
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity style={styles.showPasswordBtn} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={20} stroke="#958786" /> : <Eye size={20} stroke="#958786" />}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.button} disabled={loading} onPress={handleRegister}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Create Account</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 20 }}>
                <Text style={styles.footerText}>
                  Already have an account? <Text style={styles.footerLink}>Log in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
};

export default RegisterScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFDFD' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  content: { alignItems: 'center', paddingVertical: 20 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 16, color: '#000', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#958786', marginBottom: 24, textAlign: 'center' },
  form: { width: '100%' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#DDD', fontSize: 16, color: '#1A1A1A' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#DDD' },
  passwordInput: { flex: 1, padding: 15, fontSize: 16, color: '#1A1A1A' },
  showPasswordBtn: { padding: 15, justifyContent: 'center', alignItems: 'center' },
  button: { backgroundColor: '#AD9B8D', paddingVertical: 15, borderRadius: 12, width: '100%', alignItems: 'center', height: 55, justifyContent: 'center', marginTop: 24 },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  footerText: { color: '#958786', fontSize: 14, textAlign: 'center' },
  footerLink: { color: '#AD9B8D', fontWeight: '700' },
});
