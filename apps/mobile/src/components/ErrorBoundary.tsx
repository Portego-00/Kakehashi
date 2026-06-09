import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorService } from '../services/errorService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isReloading: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isReloading: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true, isReloading: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to our service
    errorService.logError(error, {
      isFatal: true,
      componentStack: errorInfo.componentStack ?? undefined,
    }).catch(() => {
      // Ignore logging errors
    });

    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleReload = async () => {
    this.setState({ isReloading: true });

    try {
      // Try to reload the app using expo-updates
      await Updates.reloadAsync();
    } catch (error) {
      // If Updates.reloadAsync fails (e.g., in dev mode), just reset state
      console.log('Could not reload via Updates, resetting error state');
      this.setState({ hasError: false, isReloading: false });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="warning-outline" size={64} color="#e53935" />
            </View>

            <Text style={styles.title}>Oops! Something went wrong</Text>

            <Text style={styles.message}>
              We encountered an unexpected error.
              {'\n\n'}
              Try refreshing the app to continue.
            </Text>

            <TouchableOpacity
              style={[styles.button, this.state.isReloading && styles.buttonDisabled]}
              onPress={this.handleReload}
              disabled={this.state.isReloading}
              activeOpacity={0.8}
            >
              <Ionicons
                name="refresh"
                size={20}
                color="#fff"
                style={styles.buttonIcon}
              />
              <Text style={styles.buttonText}>
                {this.state.isReloading ? 'Reloading...' : 'Refresh App'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.footer}>
              If this keeps happening, try uninstalling and reinstalling the app.
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A86FF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    marginTop: 24,
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
});
