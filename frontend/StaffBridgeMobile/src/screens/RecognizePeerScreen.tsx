import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';

const RecognizePeerScreen = () => {
  const navigation = useNavigation();
  const { state } = useAuth();
  const user = state.user;
  const [peers, setPeers] = useState<any[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [loadingPeers, setLoadingPeers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchPeers = async () => {
      setLoadingPeers(true);
      try {
        const res = await apiService.getActivePeers();
        setPeers(res);
      } catch (err) {
        Alert.alert('Error', 'Failed to load peers');
      } finally {
        setLoadingPeers(false);
      }
    };
    fetchPeers();
  }, []);

  const handleSubmit = async () => {
    if (!selectedPeer || !message.trim()) {
      Alert.alert('Validation', 'Please select a peer and enter a message.');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.createPeerRecognition({
        submitter: (user as any)._id,
        recognized: selectedPeer._id,
        comment: message,
        organization: (user as any).organization._id,
      });
      setSubmitting(false);
      Alert.alert('Success', 'Recognition submitted!');
      navigation.goBack();
    } catch (err) {
      setSubmitting(false);
      Alert.alert('Error', 'Failed to submit recognition.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recognize a Peer</Text>
      <Text style={styles.label}>Select Peer to Recognize</Text>
      {loadingPeers ? (
        <ActivityIndicator size="small" color="#007bff" />
      ) : (
        <>
          <TouchableOpacity style={styles.dropdown} onPress={() => setModalVisible(true)}>
            <Text style={{ color: selectedPeer ? '#222' : '#888' }}>
              {selectedPeer ? selectedPeer.fullName : 'Choose a peer...'}
            </Text>
          </TouchableOpacity>
          <Modal
            visible={modalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
          >
            <TouchableOpacity style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
              <View style={styles.modalContent}>
                <FlatList
                  data={peers}
                  keyExtractor={item => item._id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={() => {
                        setSelectedPeer(item);
                        setModalVisible(false);
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{item.fullName}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      )}
      <Text style={styles.label}>Recognition Message</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Share what makes this person exceptional..."
        value={message}
        onChangeText={setMessage}
        maxLength={500}
        multiline
      />
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting || loadingPeers}>
        <Text style={styles.buttonText}>{submitting ? 'Submitting...' : 'Submit Recognition'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#222',
    alignSelf: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 18,
    backgroundColor: '#fafbfc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    width: '80%',
    maxHeight: 350,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 16,
    backgroundColor: '#fafbfc',
    marginBottom: 18,
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RecognizePeerScreen; 