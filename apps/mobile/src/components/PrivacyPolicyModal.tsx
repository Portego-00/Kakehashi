import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

const LAST_UPDATED = 'January 16, 2025';
const APP_NAME = 'Kakehashi';
const CONTACT_EMAIL = 'kakehashi.app@gmail.com';

export default function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={[styles.container]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.lastUpdated}>Last Updated: {LAST_UPDATED}</Text>

          <Section title="Introduction">
            <Text style={styles.paragraph}>
              Welcome to {APP_NAME}. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application. Please read this privacy policy carefully. By using {APP_NAME}, you agree to the collection and use of information in accordance with this policy.
            </Text>
          </Section>

          <Section title="Information We Collect">
            <Text style={styles.subheading}>Account Information</Text>
            <Text style={styles.paragraph}>
              {APP_NAME} uses the WaniKani service for Japanese language learning. To use our app, you must have a WaniKani account. We collect and store:
            </Text>
            <BulletList items={[
              'Your WaniKani API token (stored securely in encrypted device storage)',
              'Your WaniKani username and profile information',
              'Your learning progress, including lessons, reviews, and statistics',
            ]} />

            <Text style={styles.subheading}>Locally Stored Data</Text>
            <Text style={styles.paragraph}>
              To provide offline functionality and improve performance, we cache the following data locally on your device:
            </Text>
            <BulletList items={[
              'Learning subjects (kanji, radicals, vocabulary)',
              'Assignment data and review schedules',
              'Study materials and user notes',
              'Review statistics and level progressions',
              'App preferences and settings',
            ]} />

            <Text style={styles.subheading}>Device Permissions</Text>
            <Text style={styles.paragraph}>
              {APP_NAME} may request the following device permissions:
            </Text>
            <BulletList items={[
              'Camera: To scan and recognize Japanese text using OCR',
              'Photo Library: To save images and access photos for text recognition',
              'Microphone: For voice input and pronunciation practice features',
              'Speech Recognition: To enable voice-based interactions',
              'Notifications: To remind you about available reviews',
            ]} />
            <Text style={styles.paragraph}>
              These permissions are only used for the stated purposes and are never used to collect data without your explicit action.
            </Text>
          </Section>

          <Section title="How We Use Your Information">
            <Text style={styles.paragraph}>
              We use your information to:
            </Text>
            <BulletList items={[
              'Authenticate you with the WaniKani service',
              'Display your learning progress and statistics',
              'Provide offline access to your study materials',
              'Send you notifications about available reviews (if enabled)',
              'Process Japanese text through OCR when you use the camera feature',
            ]} />
          </Section>

          <Section title="Third-Party Services">
            <Text style={styles.paragraph}>
              {APP_NAME} integrates with the following third-party services:
            </Text>

            <Text style={styles.subheading}>WaniKani (Tofugu LLC)</Text>
            <Text style={styles.paragraph}>
              We access the WaniKani API to retrieve and sync your learning data. Your use of WaniKani is subject to their own Privacy Policy and Terms of Service.
            </Text>

            <Text style={styles.subheading}>Google ML Kit</Text>
            <Text style={styles.paragraph}>
              We use Google ML Kit for on-device text recognition (OCR). Images you scan are processed locally on your device and are not sent to external servers.
            </Text>
          </Section>

          <Section title="Data Storage and Security">
            <Text style={styles.paragraph}>
              We take data security seriously:
            </Text>
            <BulletList items={[
              'Your WaniKani API token is stored in encrypted device storage (iOS Keychain)',
              'Cached learning data is stored in encrypted local storage',
              'All network communications use secure HTTPS connections',
              'We do not store your WaniKani password',
            ]} />
            <Text style={styles.paragraph}>
              While we implement security measures, no method of electronic storage is 100% secure. We cannot guarantee absolute security of your data.
            </Text>
          </Section>

          <Section title="Data Retention">
            <Text style={styles.paragraph}>
              Your data is retained as follows:
            </Text>
            <BulletList items={[
              'Cached learning data is refreshed periodically and deleted upon logout',
              'Local preferences are cleared when you uninstall the app',
            ]} />
          </Section>

          <Section title="Your Rights and Choices">
            <Text style={styles.paragraph}>
              You have control over your data:
            </Text>
            <BulletList items={[
              'Log out at any time to remove your API token from the device',
              'Deny or revoke device permissions through your device settings',
              'Disable notifications through your device settings',
              'Delete the app to remove all locally stored data',
              'Manage your WaniKani account directly on wanikani.com',
            ]} />
          </Section>

          <Section title="Changes to This Policy">
            <Text style={styles.paragraph}>
              We may update this Privacy Policy from time to time. We will notify you of any changes by updating the &quot;Last Updated&quot; date at the top of this policy. You are advised to review this Privacy Policy periodically for any changes.
            </Text>
          </Section>

          <Section title="Contact Us">
            <Text style={styles.paragraph}>
              If you have questions or concerns about this Privacy Policy, please contact us at:
            </Text>
            <Text style={styles.contactInfo}>
              Email: {CONTACT_EMAIL}
            </Text>
          </Section>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
    marginBottom: 12,
  },
  bulletList: {
    marginBottom: 12,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 15,
    color: '#00A3FF',
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
  },
  contactInfo: {
    fontSize: 15,
    lineHeight: 24,
    color: '#00A3FF',
    marginTop: 8,
  },
  footer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#999',
  },
});
