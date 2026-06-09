import { Ionicons } from '@expo/vector-icons';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  type KeyboardEvent,
  type LayoutChangeEvent,
  LayoutAnimation,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from 'react-native';
import WaniKaniWebClient from '../../src/modules/WaniKaniWebClient';
import { getUserData, validateApiToken } from '../../src/utils/api';
import { getCacheStatus } from '../../src/utils/cache';
import { useAuthStore, useSettingsStore } from '../../src/utils/store';
import { useSession } from '../../src/contexts/AuthContext';
import PrivacyPolicyModal from '../../src/components/PrivacyPolicyModal';

type LoginMethod = 'email' | 'token';

export default function Login() {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [androidFormLayoutHeight, setAndroidFormLayoutHeight] = useState(0);
  const { signIn } = useSession();
  const { setUserData, setNeedsPostLoginCaching } = useAuthStore();

  // Refs for keyboard navigation
  const passwordInputRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);
  const androidBaselineFormHeightRef = useRef(0);

  // Animation values for smooth transitions
  const formContentOpacity = useRef(new Animated.Value(1)).current;

  // Screen dimensions for responsive design
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isTablet = screenWidth > 768;
  const isIOS = Platform.OS === 'ios';

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleKeyboardDidShow = (event: KeyboardEvent) => {
      const nextHeight = Math.max(0, Math.round(event.endCoordinates?.height ?? 0));
      setAndroidKeyboardHeight(nextHeight);
    };

    const handleKeyboardDidHide = () => {
      setAndroidKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener('keyboardDidShow', handleKeyboardDidShow);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', handleKeyboardDidHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (androidKeyboardHeight > 0 || androidFormLayoutHeight <= 0) return;
    androidBaselineFormHeightRef.current = Math.max(
      androidBaselineFormHeightRef.current,
      androidFormLayoutHeight
    );
  }, [androidKeyboardHeight, androidFormLayoutHeight]);

  const handleFormContainerLayout = (event: LayoutChangeEvent) => {
    if (Platform.OS !== 'android') return;
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setAndroidFormLayoutHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight
    );
  };

  const syncAndroidKeyboardMetrics = () => {
    if (Platform.OS !== 'android') return;

    const syncMetrics = () => {
      if (!mountedRef.current) return;
      const keyboardMetrics = Keyboard.metrics();
      const measuredHeight = Math.max(0, Math.round(keyboardMetrics?.height ?? 0));
      if (measuredHeight > 0) {
        setAndroidKeyboardHeight(measuredHeight);
      }
    };

    requestAnimationFrame(syncMetrics);
    setTimeout(syncMetrics, 120);
  };

  const androidAppliedKeyboardResize =
    Platform.OS === 'android' &&
    androidKeyboardHeight > 0 &&
    androidBaselineFormHeightRef.current > 0
      ? Math.max(0, androidBaselineFormHeightRef.current - androidFormLayoutHeight)
      : 0;
  const androidKeyboardFallbackLift =
    Platform.OS === 'android' && androidKeyboardHeight > 0
      ? Math.max(0, androidKeyboardHeight - androidAppliedKeyboardResize)
      : 0;
  const androidKeyboardLift = Math.min(
    androidKeyboardFallbackLift,
    Math.round(screenHeight * 0.6)
  );

  // Handle tab change with smooth animation
  const handleTabChange = (index: number) => {
    const method: LoginMethod = index === 0 ? 'email' : 'token';

    // First, fade out form content only
    Animated.timing(formContentOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
              // Configure smooth layout animation for card height change
        LayoutAnimation.configureNext({
          duration: 300,
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
          },
        });

      // Change content (this will trigger the height animation)
      setLoginMethod(method);
      setSelectedIndex(index);

      // Then fade in form content
      Animated.timing(formContentOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      const loginResult = await WaniKaniWebClient.login(email, password);

      const isValid = await validateApiToken(loginResult.apiToken);
      if (isValid) {
        const userData = await getUserData(loginResult.apiToken);

        // Use the new signIn method from AuthContext
        await signIn(loginResult.apiToken);
        setUserData(userData.data);

        // Prepopulate Gravatar email if logging in with email
        useSettingsStore.getState().setGravatarEmail(email);

        const cacheStatus = await getCacheStatus();
        if (!cacheStatus.hasFreshCache && !cacheStatus.hasStaleCache) {
          setNeedsPostLoginCaching(true);
        }

        // Navigation is handled by AuthContext
      } else {
        Alert.alert('Error', 'Login succeeded but API token is invalid. Please try again.');
      }
    } catch (error: any) {
      let errorMessage = 'Failed to authenticate. Please try again later.';

      if (error.code === 'WANIKANI_ERROR') {
        switch (error.message) {
          case 'CSRF token not found':
            errorMessage = 'Authentication failed. Please try again.';
            break;
          case 'Incorrect email or password':
            errorMessage = 'Incorrect email or password. Please check your credentials.';
            break;
          case 'Account is in hibernation mode':
            errorMessage = 'Your account is in hibernation mode. Please reactivate it on the WaniKani website.';
            break;
          case 'API token not found':
            errorMessage = 'Login failed. Please check your email and password.';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }

      Alert.alert('Error', errorMessage);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenLogin = async () => {
    if (!apiToken.trim()) {
      Alert.alert('Error', 'Please enter your API token');
      return;
    }

    setIsLoading(true);
    try {
      const isValid = await validateApiToken(apiToken);
      if (isValid) {
        const userData = await getUserData(apiToken);

        // Use the new signIn method from AuthContext
        await signIn(apiToken);
        setUserData(userData.data);

        const cacheStatus = await getCacheStatus();
        if (!cacheStatus.hasFreshCache && !cacheStatus.hasStaleCache) {
          setNeedsPostLoginCaching(true);
        }

        // Navigation is handled by AuthContext
      } else {
        Alert.alert('Error', 'Invalid API token. Please check and try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to authenticate. Please try again later.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    if (loginMethod === 'email') {
      handleEmailLogin();
    } else {
      handleTokenLogin();
    }
  };

  const openWaniKaniWebsite = () => {
    if (loginMethod === 'token') {
      Linking.openURL('https://www.wanikani.com/settings/personal_access_tokens');
    } else {
      Linking.openURL('https://www.wanikani.com/login');
    }
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2', '#f093fb']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fullScreenGradient}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <StatusBar style="light" />

          <View style={styles.headerContainer}>
            <Image
              source={require('../../assets/images/login.png')}
              style={[
                styles.loginImage,
                {
                  width: isTablet ? screenWidth * 0.6 : screenWidth * 0.8,
                  height: isTablet ? 160 : 120,
                }
              ]}
              resizeMode="contain"
            />
            <Text style={styles.title}>Kakehashi</Text>
            {/* <Text style={styles.subtitle}>Learn Japanese with Kakehashi</Text> */}
          </View>

          <KeyboardAvoidingView
            style={[
              styles.formContainer,
              Platform.OS === 'android' &&
                androidKeyboardLift > 0 && { paddingBottom: androidKeyboardLift },
            ]}
            behavior={isIOS ? 'padding' : 'height'}
            keyboardVerticalOffset={isIOS ? 60 : 0}
            onLayout={handleFormContainerLayout}
          >
            <View style={styles.card}>
              <SegmentedControl
                values={['Email Login', 'API Token']}
                selectedIndex={selectedIndex}
                onChange={(event) => {
                  handleTabChange(event.nativeEvent.selectedSegmentIndex);
                }}
                style={styles.segmentedControl}
                tintColor="#00A3FF"
                backgroundColor="#f5f5f5"
                fontStyle={{ color: '#666', fontSize: 16 }}
                activeFontStyle={{ color: 'white', fontSize: 16, fontWeight: '600' }}
              />

              <Animated.View
                style={[
                  styles.formContent,
                  {
                    opacity: formContentOpacity,
                  }
                ]}
              >
                {loginMethod === 'email' ? (
                  <>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={styles.input}
                      defaultValue={email}
                      onChangeText={setEmail}
                      onFocus={syncAndroidKeyboardMetrics}
                      placeholder="Enter your email"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                    />

                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        ref={passwordInputRef}
                        style={styles.passwordInput}
                        defaultValue={password}
                        onChangeText={setPassword}
                        onFocus={syncAndroidKeyboardMetrics}
                        placeholder="Enter your password"
                        placeholderTextColor="#999"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="password"
                        textContentType="password"
                        returnKeyType="go"
                        onSubmitEditing={handleLogin}
                      />
                      <TouchableOpacity
                        style={styles.passwordToggle}
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off' : 'eye'}
                          size={24}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>API Token</Text>
                    <TextInput
                      style={styles.input}
                      defaultValue={apiToken}
                      onChangeText={setApiToken}
                      onFocus={syncAndroidKeyboardMetrics}
                      placeholder="Paste your API token here"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.buttonText}>
                      Login
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={openWaniKaniWebsite} style={styles.link}>
                  <Text style={styles.linkText}>
                    {loginMethod === 'token'
                      ? 'Get your API token from WaniKani settings'
                      : 'Or get your API token from WaniKani settings'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

            <TouchableOpacity
              onPress={() => setShowPrivacyPolicy(true)}
              style={styles.privacyLink}
            >
              <Text style={styles.privacyLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>

      <PrivacyPolicyModal
        visible={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  loginImage: {
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  fullScreenGradient: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  segmentedControl: {
    marginBottom: 24,
    height: 44,
  },
  formContent: {
    // This container will have animated opacity
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
    backgroundColor: 'white',
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingRight: 50,
    backgroundColor: 'white',
    color: '#333',
  },
  passwordToggle: {
    position: 'absolute',
    right: 15,
    padding: 5,
  },
  button: {
    backgroundColor: '#00A3FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    height: 54,
    justifyContent: 'center',
    shadowColor: '#00A3FF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#87CEEB',
    shadowOpacity: 0.1,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#00A3FF',
    textAlign: 'center',
  },
  privacyLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  privacyLinkText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
