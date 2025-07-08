import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  List,
  Divider,
  ActivityIndicator,
  FAB,
  Portal,
  Modal,
  TextInput,
  SegmentedButtons,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedDate: string;
  approvedBy?: string;
  approvedDate?: string;
  comments?: string;
}

const LeaveScreen: React.FC = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [newRequest, setNewRequest] = useState({
    type: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const { state } = useAuth();
  const { theme } = useTheme();

  const loadLeaveRequests = async () => {
    try {
      // TODO: Replace with actual API call
      const mockData: LeaveRequest[] = [
        {
          id: '1',
          type: 'Annual Leave',
          startDate: '2024-01-15',
          endDate: '2024-01-17',
          reason: 'Family vacation',
          status: 'approved',
          submittedDate: '2024-01-10',
          approvedBy: 'John Manager',
          approvedDate: '2024-01-11',
        },
        {
          id: '2',
          type: 'Sick Leave',
          startDate: '2024-01-20',
          endDate: '2024-01-21',
          reason: 'Medical appointment',
          status: 'pending',
          submittedDate: '2024-01-18',
        },
        {
          id: '3',
          type: 'Personal Leave',
          startDate: '2024-01-25',
          endDate: '2024-01-25',
          reason: 'Personal matters',
          status: 'rejected',
          submittedDate: '2024-01-22',
          approvedBy: 'John Manager',
          approvedDate: '2024-01-23',
          comments: 'Insufficient notice period',
        },
      ];
      setLeaveRequests(mockData);
    } catch (error) {
      console.error('Error loading leave requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaveRequests();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return theme.colors.success;
      case 'pending':
        return theme.colors.warning;
      case 'rejected':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'check-circle';
      case 'pending':
        return 'clock-outline';
      case 'rejected':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Include both start and end dates
  };

  const filteredRequests = leaveRequests.filter(request => {
    if (selectedFilter === 'all') return true;
    return request.status === selectedFilter;
  });

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Leave Summary */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Title style={[styles.cardTitle, { color: theme.colors.text }]}>
              Leave Summary
            </Title>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Title style={[styles.summaryNumber, { color: theme.colors.primary }]}>
                  {leaveRequests.filter(r => r.status === 'approved').length}
                </Title>
                <Paragraph style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                  Approved
                </Paragraph>
              </View>
              <View style={styles.summaryItem}>
                <Title style={[styles.summaryNumber, { color: theme.colors.warning }]}>
                  {leaveRequests.filter(r => r.status === 'pending').length}
                </Title>
                <Paragraph style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                  Pending
                </Paragraph>
              </View>
              <View style={styles.summaryItem}>
                <Title style={[styles.summaryNumber, { color: theme.colors.error }]}>
                  {leaveRequests.filter(r => r.status === 'rejected').length}
                </Title>
                <Paragraph style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                  Rejected
                </Paragraph>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Filter */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <SegmentedButtons
              value={selectedFilter}
              onValueChange={setSelectedFilter}
              buttons={[
                { value: 'all', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              style={styles.filterButtons}
            />
          </Card.Content>
        </Card>

        {/* Leave Requests */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Title style={[styles.cardTitle, { color: theme.colors.text }]}>
              Leave Requests
            </Title>
            {filteredRequests.length === 0 ? (
              <Paragraph style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No leave requests found.
              </Paragraph>
            ) : (
              filteredRequests.map((request, index) => (
                <React.Fragment key={request.id}>
                  <List.Item
                    title={request.type}
                    description={
                      <View>
                        <Paragraph style={[styles.requestText, { color: theme.colors.textSecondary }]}>
                          {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          {' • '}{calculateDays(request.startDate, request.endDate)} days
                        </Paragraph>
                        <Paragraph style={[styles.requestText, { color: theme.colors.textSecondary }]}>
                          {request.reason}
                        </Paragraph>
                        <Chip
                          mode="outlined"
                          textStyle={{ color: getStatusColor(request.status) }}
                          style={[
                            styles.statusChip,
                            { borderColor: getStatusColor(request.status) },
                          ]}
                        >
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Chip>
                        {request.comments && (
                          <Paragraph style={[styles.commentText, { color: theme.colors.error }]}>
                            Comment: {request.comments}
                          </Paragraph>
                        )}
                      </View>
                    }
                    left={(props) => (
                      <List.Icon
                        {...props}
                        icon={getStatusIcon(request.status)}
                        color={getStatusColor(request.status)}
                      />
                    )}
                    titleStyle={[styles.requestTitle, { color: theme.colors.text }]}
                  />
                  {index < filteredRequests.length - 1 && <Divider />}
                </React.Fragment>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* FAB for new request */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setModalVisible(true)}
      />

      {/* New Request Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Title style={[styles.modalTitle, { color: theme.colors.text }]}>
            New Leave Request
          </Title>
          
          <TextInput
            label="Leave Type"
            value={newRequest.type}
            onChangeText={(text) => setNewRequest({ ...newRequest, type: text })}
            mode="outlined"
            style={styles.modalInput}
          />
          
          <TextInput
            label="Start Date"
            value={newRequest.startDate}
            onChangeText={(text) => setNewRequest({ ...newRequest, startDate: text })}
            mode="outlined"
            style={styles.modalInput}
            placeholder="YYYY-MM-DD"
          />
          
          <TextInput
            label="End Date"
            value={newRequest.endDate}
            onChangeText={(text) => setNewRequest({ ...newRequest, endDate: text })}
            mode="outlined"
            style={styles.modalInput}
            placeholder="YYYY-MM-DD"
          />
          
          <TextInput
            label="Reason"
            value={newRequest.reason}
            onChangeText={(text) => setNewRequest({ ...newRequest, reason: text })}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.modalInput}
          />
          
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                // TODO: Submit leave request
                setModalVisible(false);
              }}
              style={styles.modalButton}
            >
              Submit
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 16,
    marginTop: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
  },
  filterButtons: {
    marginBottom: 8,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  requestText: {
    fontSize: 14,
    marginBottom: 4,
  },
  statusChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  commentText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});

export default LeaveScreen; 