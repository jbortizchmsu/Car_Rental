// Pure date/duration helpers extracted from BookingFormScreen.tsx so they can be unit-tested
// without importing that screen (which pulls in native modules that can't run outside a real
// app/device runtime, e.g. @react-native-async-storage/async-storage).

export const formatDateOnly = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatExpiryDisplay = (d: Date | null): string => {
  if (!d) return 'Select license expiry date...';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const calcDays = (start: Date, end: Date) => {
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
