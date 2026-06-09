import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllSessions,
  analyzeSession,
  clearPerformanceLogs,
  PerformanceSession,
  PerformanceLog,
} from '../utils/performanceLogger';
import { useTheme } from '../utils/theme';

interface PerformanceDashboardProps {
  visible: boolean;
  onClose: () => void;
}

export default function PerformanceDashboard({ visible, onClose }: PerformanceDashboardProps) {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<PerformanceSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<PerformanceSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const loadSessions = async () => {
    const allSessions = await getAllSessions();
    setSessions(allSessions.reverse()); // Most recent first
  };

  useEffect(() => {
    if (visible) {
      loadSessions();
    }
  }, [visible]);

  // Hide performance dashboard in production
  if (!__DEV__) {
    return null;
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleClearLogs = async () => {
    await clearPerformanceLogs();
    setSessions([]);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusIcon = (success: boolean) => {
    return success ? '✅' : '❌';
  };

  const renderSessionSummary = ({ item: session }: { item: PerformanceSession }) => {
    const analysis = analyzeSession(session);
    const duration = session.totalDuration || 0;
    
    return (
      <TouchableOpacity
        style={[styles.sessionCard, { backgroundColor: theme.cardBackground }]}
        onPress={() => {
          setSelectedSession(session);
          setDetailsVisible(true);
        }}
      >
        <View style={styles.sessionHeader}>
          <Text style={[styles.sessionTitle, { color: theme.textColor }]}>
            {new Date(session.startTime).toLocaleTimeString()}
          </Text>
          <Text style={[styles.sessionDuration, { color: theme.secondary }]}>
            {formatDuration(duration)}
          </Text>
        </View>
        
        <View style={styles.sessionStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Operations</Text>
            <Text style={[styles.statValue, { color: theme.textColor }]}>{session.logs.length}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>API Calls</Text>
            <Text style={[styles.statValue, { color: theme.textColor }]}>{analysis.apiCalls.length}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Cache Ops</Text>
            <Text style={[styles.statValue, { color: theme.textColor }]}>{analysis.cacheOperations.length}</Text>
          </View>
        </View>

        {analysis.failedOperations.length > 0 && (
          <View style={[styles.errorBadge, { backgroundColor: theme.error + '20' }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>
              {analysis.failedOperations.length} failed operations
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderLogDetail = ({ item: log }: { item: PerformanceLog }) => {
    const contextStr = log.context ? ` [${log.context}]` : '';
    
    return (
      <View style={[styles.logItem, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.logHeader}>
          <Text style={[styles.logOperation, { color: theme.textColor }]}>
            {getStatusIcon(log.success)} {log.operation}{contextStr}
          </Text>
          <Text style={[styles.logDuration, { color: theme.secondary }]}>
            {formatDuration(log.duration)}
          </Text>
        </View>
        
        {log.details && (
          <Text style={[styles.logDetails, { color: theme.textSecondary }]}>
            {JSON.stringify(log.details, null, 2)}
          </Text>
        )}
        
        <Text style={[styles.logTimestamp, { color: theme.textSecondary }]}>
          {new Date(log.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  const logSessionToConsole = () => {
    if (!selectedSession) return;
    
    const analysis = analyzeSession(selectedSession);
    
    const sessionSummary = {
      sessionInfo: {
        sessionId: selectedSession.sessionId,
        startTime: new Date(selectedSession.startTime).toISOString(),
        endTime: selectedSession.endTime ? new Date(selectedSession.endTime).toISOString() : null,
        totalDuration: selectedSession.totalDuration || 0,
        totalOperations: selectedSession.logs.length,
      },
      performanceBreakdown: {
        totalTime: analysis.totalTime,
        apiCallsCount: analysis.apiCalls.length,
        cacheOperationsCount: analysis.cacheOperations.length,
        failedOperationsCount: analysis.failedOperations.length,
      },
      apiCalls: analysis.apiCalls.map(log => ({
        operation: log.operation,
        context: log.context,
        duration: log.duration,
        success: log.success,
        details: log.details,
        timestamp: new Date(log.timestamp).toISOString(),
      })),
      cacheOperations: analysis.cacheOperations.map(log => ({
        operation: log.operation,
        context: log.context,
        duration: log.duration,
        success: log.success,
        details: log.details,
        timestamp: new Date(log.timestamp).toISOString(),
      })),
      slowestOperations: analysis.slowestOperations.slice(0, 10).map(log => ({
        operation: log.operation,
        context: log.context,
        duration: log.duration,
        success: log.success,
        details: log.details,
        timestamp: new Date(log.timestamp).toISOString(),
      })),
      failedOperations: analysis.failedOperations.map(log => ({
        operation: log.operation,
        context: log.context,
        duration: log.duration,
        details: log.details,
        timestamp: new Date(log.timestamp).toISOString(),
      })),
      allOperations: selectedSession.logs.map(log => ({
        operation: log.operation,
        context: log.context,
        duration: log.duration,
        success: log.success,
        details: log.details,
        timestamp: new Date(log.timestamp).toISOString(),
      })),
    };
    
    console.log('='.repeat(80));
    console.log('📊 PERFORMANCE SESSION ANALYSIS');
    console.log('='.repeat(80));
    console.log('Session ID:', sessionSummary.sessionInfo.sessionId);
    console.log('Start Time:', sessionSummary.sessionInfo.startTime);
    console.log('Total Duration:', `${sessionSummary.sessionInfo.totalDuration}ms`);
    console.log('Total Operations:', sessionSummary.sessionInfo.totalOperations);
    console.log('');
    console.log('📈 Performance Breakdown:');
    console.log(`- API Calls: ${sessionSummary.performanceBreakdown.apiCallsCount} (${sessionSummary.apiCalls.reduce((sum, op) => sum + op.duration, 0).toFixed(2)}ms total)`);
    console.log(`- Cache Operations: ${sessionSummary.performanceBreakdown.cacheOperationsCount} (${sessionSummary.cacheOperations.reduce((sum, op) => sum + op.duration, 0).toFixed(2)}ms total)`);
    console.log(`- Failed Operations: ${sessionSummary.performanceBreakdown.failedOperationsCount}`);
    console.log('');
    console.log('🐌 Top 5 Slowest Operations:');
    sessionSummary.slowestOperations.slice(0, 5).forEach((op, index) => {
      console.log(`${index + 1}. ${op.operation} [${op.context || 'N/A'}]: ${op.duration.toFixed(2)}ms`);
      if (op.details) console.log(`   Details:`, op.details);
    });
    console.log('');
    console.log('❌ Failed Operations:');
    if (sessionSummary.failedOperations.length === 0) {
      console.log('   None! 🎉');
    } else {
      sessionSummary.failedOperations.forEach((op, index) => {
        console.log(`${index + 1}. ${op.operation} [${op.context || 'N/A'}]: ${op.duration.toFixed(2)}ms`);
        if (op.details) console.log(`   Details:`, op.details);
      });
    }
    console.log('');
    console.log('📋 COMPLETE SESSION DATA (JSON):');
    console.log('='.repeat(80));
    console.log(JSON.stringify(sessionSummary, null, 2));
    console.log('='.repeat(80));
    console.log('💡 TIP: You can copy the JSON data above to share for detailed analysis');
    console.log('='.repeat(80));
  };

  const renderAnalysis = () => {
    if (!selectedSession) return null;
    
    const analysis = analyzeSession(selectedSession);
    
    return (
      <View style={styles.analysisSection}>
        <Text style={[styles.analysisTitle, { color: theme.textColor }]}>Performance Analysis</Text>
        
        <View style={styles.analysisGrid}>
          <View style={styles.analysisItem}>
            <Text style={[styles.analysisLabel, { color: theme.textSecondary }]}>Total Time</Text>
            <Text style={[styles.analysisValue, { color: theme.primary }]}>
              {formatDuration(analysis.totalTime)}
            </Text>
          </View>
          
          <View style={styles.analysisItem}>
            <Text style={[styles.analysisLabel, { color: theme.textSecondary }]}>API Calls</Text>
            <Text style={[styles.analysisValue, { color: theme.textColor }]}>
              {analysis.apiCalls.length}
            </Text>
          </View>
          
          <View style={styles.analysisItem}>
            <Text style={[styles.analysisLabel, { color: theme.textSecondary }]}>Cache Hits</Text>
            <Text style={[styles.analysisValue, { color: theme.textColor }]}>
              {analysis.cacheOperations.filter(op => 
                op.details && op.details.result === 'hit'
              ).length}
            </Text>
          </View>
          
          <View style={styles.analysisItem}>
            <Text style={[styles.analysisLabel, { color: theme.textSecondary }]}>Failures</Text>
            <Text style={[styles.analysisValue, { color: theme.error }]}>
              {analysis.failedOperations.length}
            </Text>
          </View>
        </View>

        {analysis.slowestOperations.length > 0 && (
          <View style={styles.slowestSection}>
            <Text style={[styles.slowestTitle, { color: theme.textColor }]}>Slowest Operations</Text>
            {analysis.slowestOperations.slice(0, 5).map((log, index) => (
              <View key={log.id} style={styles.slowestItem}>
                <Text style={[styles.slowestOperation, { color: theme.textSecondary }]}>
                  {index + 1}. {log.operation}
                </Text>
                <Text style={[styles.slowestDuration, { color: theme.error }]}>
                  {formatDuration(log.duration)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <Text style={[styles.title, { color: theme.headerText }]}>Performance Dashboard</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.headerText} />
          </TouchableOpacity>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: theme.primary }]}
            onPress={handleClearLogs}
          >
            <Text style={[styles.controlButtonText, { color: 'white' }]}>Clear Logs</Text>
          </TouchableOpacity>
          
          <Text style={[styles.sessionCount, { color: theme.textSecondary }]}>
            {sessions.length} sessions recorded
          </Text>
        </View>

        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No performance data available.
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Refresh the homepage to start collecting performance metrics.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            renderItem={renderSessionSummary}
            keyExtractor={(item) => item.sessionId}
            contentContainerStyle={styles.sessionsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.primary]}
                tintColor={theme.primary}
              />
            }
          />
        )}

        {/* Details Modal */}
        <Modal 
          visible={detailsVisible} 
          animationType="slide" 
          presentationStyle="pageSheet"
        >
          <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
            <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
              <TouchableOpacity 
                onPress={logSessionToConsole}
                style={[styles.headerButton, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="copy-outline" size={18} color="white" />
                <Text style={[styles.headerButtonText, { color: 'white' }]}>Log to Console</Text>
              </TouchableOpacity>
              
              <Text style={[styles.title, { color: theme.headerText }]}>
                Session Details
              </Text>
              
              <TouchableOpacity 
                onPress={() => setDetailsVisible(false)} 
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.headerText} />
              </TouchableOpacity>
            </View>

            {selectedSession && (
              <ScrollView style={styles.detailsContent}>
                {renderAnalysis()}
                
                <Text style={[styles.logsTitle, { color: theme.textColor }]}>
                  All Operations ({selectedSession.logs.length})
                </Text>
                
                <FlatList
                  data={selectedSession.logs}
                  renderItem={renderLogDetail}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </ScrollView>
            )}
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  controlButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controlButtonText: {
    fontWeight: '600',
  },
  sessionCount: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  sessionsList: {
    padding: 16,
  },
  sessionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sessionDuration: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBadge: {
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsContent: {
    flex: 1,
    padding: 16,
  },
  analysisSection: {
    marginBottom: 24,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  analysisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  analysisItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
  },
  analysisLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  analysisValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  slowestSection: {
    marginTop: 16,
  },
  slowestTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  slowestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  slowestOperation: {
    flex: 1,
    fontSize: 14,
  },
  slowestDuration: {
    fontSize: 14,
    fontWeight: '600',
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  logItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logOperation: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  logDuration: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  logDetails: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginVertical: 4,
  },
  logTimestamp: {
    fontSize: 10,
    marginTop: 4,
  },
});
