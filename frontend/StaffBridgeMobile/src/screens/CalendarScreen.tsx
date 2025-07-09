import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { Title, HelperText } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import { CalendarList, Agenda, Calendar } from 'react-native-calendars';

const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0];
};

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const isInCurrentMonth = (date: Date, now: Date) =>
  date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

const isUpcoming = (date: Date, now: Date) =>
  date >= new Date(now.getFullYear(), now.getMonth(), now.getDate());

const getEventColor = (type: string) => {
  // You can customize event colors by type
  return '#1976D2';
};

const CalendarScreen: React.FC = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiService.getEvents();
        const now = new Date();
        // Filter events: current month and upcoming
        const filtered = data.filter((event: any) => {
          const start = new Date(event.start);
          const end = new Date(event.end);
          return (
            (isInCurrentMonth(start, now) || isInCurrentMonth(end, now)) &&
            (isUpcoming(start, now) || isUpcoming(end, now))
          );
        });
        setEvents(filtered);
        setFilteredEvents(filtered);
        // Mark dates with events
        const marks: any = {};
        filtered.forEach((event: any) => {
          const start = new Date(event.start);
          const end = new Date(event.end);
          let d = new Date(start);
          while (d <= end) {
            const key = formatDate(d);
            if (!marks[key]) marks[key] = { marked: true, dots: [], events: [], customStyles: {} };
            marks[key].dots.push({ color: getEventColor(event.type) });
            marks[key].events.push(event);
            d.setDate(d.getDate() + 1);
          }
        });
        // Highlight today
        const todayStr = formatDate(now);
        marks[todayStr] = {
          ...(marks[todayStr] || { marked: false, dots: [], events: [] }),
          customStyles: {
            container: {
              backgroundColor: theme.colors.primary,
              borderRadius: 16,
            },
            text: {
              color: '#fff',
              fontWeight: 'bold',
            },
          },
        };
        setMarkedDates(marks);
        // Default select today if in current month
        if (isInCurrentMonth(now, now)) setSelectedDate(todayStr);
      } catch (err: any) {
        setError(err.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [theme.colors.primary]);

  const renderEventList = (date: string) => {
    const dayEvents = markedDates[date]?.events || [];
    if (!dayEvents.length) return null;
    return (
      <View style={styles.eventList}>
        {dayEvents.slice(0, 2).map((event: any, idx: number) => (
          <View key={idx} style={[styles.eventBlock, { backgroundColor: getEventColor(event.type) }]}> 
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventTime}>{new Date(event.start).toLocaleDateString()} - {new Date(event.end).toLocaleDateString()}</Text>
          </View>
        ))}
        {dayEvents.length > 2 && (
          <Text style={styles.moreText}>+{dayEvents.length - 2} more</Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <Title style={styles.header}>Calendar</Title>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
      ) : error ? (
        <HelperText type="error" visible style={{ textAlign: 'center', marginTop: 32 }}>{error}</HelperText>
      ) : (
        <ScrollView>
          <Calendar
            markingType={'custom'}
            markedDates={Object.fromEntries(
              Object.entries(markedDates).map(([date, val]: [string, any]) => [date, { ...val }])
            )}
            onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
            theme={{
              backgroundColor: theme.colors.background,
              calendarBackground: theme.colors.background,
              textSectionTitleColor: '#222',
              selectedDayBackgroundColor: theme.colors.primary,
              selectedDayTextColor: '#fff',
              todayTextColor: theme.colors.primary,
              dayTextColor: '#222',
              textDisabledColor: '#ccc',
              dotColor: theme.colors.primary,
              selectedDotColor: '#fff',
              arrowColor: theme.colors.primary,
              monthTextColor: '#222',
              indicatorColor: theme.colors.primary,
            }}
            style={styles.calendar}
          />
          {selectedDate && renderEventList(selectedDate)}
          {/* List of upcoming events in current month */}
          <View style={{ margin: 16 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Upcoming Events This Month</Text>
            {filteredEvents.length === 0 ? (
              <Text style={{ color: '#888' }}>No upcoming events this month.</Text>
            ) : (
              filteredEvents
                .filter((event: any) => {
                  const now = new Date();
                  const end = new Date(event.end);
                  return isUpcoming(end, now);
                })
                .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
                .map((event: any, idx: number) => (
                  <View key={idx} style={[styles.eventBlock, { backgroundColor: getEventColor(event.type), marginBottom: 10 }]}> 
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventTime}>{new Date(event.start).toLocaleDateString()} - {new Date(event.end).toLocaleDateString()}</Text>
                  </View>
                ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 22, fontWeight: 'bold', margin: 16 },
  calendar: { marginHorizontal: 8, borderRadius: 12, overflow: 'hidden' },
  eventList: { margin: 16, marginTop: 0 },
  eventBlock: { borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#1976D2' },
  eventTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  eventTime: { color: '#fff', fontSize: 12, marginTop: 2 },
  moreText: { color: '#1976D2', fontWeight: 'bold', marginTop: 4 },
});

export default CalendarScreen; 