import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  // Bumped on every retry and used as the children's key, forcing React to fully
  // unmount and remount them (fresh state) rather than just re-rendering the same
  // instances that already threw once.
  retryKey: number;
}

/**
 * Wraps a screen so a render-time crash in it shows a recoverable fallback instead
 * of taking down the whole app (React Native has no default error boundary — an
 * uncaught render error is fatal to the native process).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught a render error:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.message}>Something went wrong. Please try again.</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FDFDFD' },
  message: { fontSize: 15, color: '#4B4B4B', textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  button: { backgroundColor: '#AD9B8D', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  buttonText: { color: '#FFF', fontWeight: '700' },
});
