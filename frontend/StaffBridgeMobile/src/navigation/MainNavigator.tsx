import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Modal from 'react-native-modal';
import { View, TouchableOpacity, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

import DashboardScreen from '../screens/DashboardScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import LeaveScreen from '../screens/LeaveScreen';
import PayrollScreen from '../screens/PayrollScreen';
import BulletinsScreen from '../screens/BulletinsScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import TrainingScreen from '../screens/TrainingScreen';
import PerformanceScreen from '../screens/PerformanceScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CalendarScreen from '../screens/CalendarScreen';
import StaffDirectoryScreen from '../screens/StaffDirectoryScreen';
import ExpenseClaimScreen from '../screens/ExpenseClaimScreen';
import ClaimsHistoryScreen from '../screens/ClaimsHistoryScreen';
import InventoryRequestScreen from '../screens/InventoryRequestScreen';
import CurrentInventoryScreen from '../screens/CurrentInventoryScreen';
import AssignedTasksScreen from '../screens/AssignedTasksScreen';
import LeaveRequestScreen from '../screens/LeaveRequestScreen';
import LeaveHistoryScreen from '../screens/LeaveHistoryScreen';
import TrainingHistoryScreen from '../screens/TrainingHistoryScreen';
import DrawerContent from '../components/DrawerContent';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import AttendanceHistoryScreen from '../screens/AttendanceHistoryScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import TrainingRequestScreen from '../screens/TrainingRequestScreen';
import PayslipScreen from '../screens/PayslipScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Requests: undefined;
  Tasks: undefined;
  Calendar: undefined;
  More: undefined;
};

export type SubmenuStackParamList = {
  // Requests submenu
  AttendanceHistory: undefined;
  LeaveRequest: undefined;
  LeaveHistory: undefined;
  ExpenseClaim: undefined;
  ClaimsHistory: undefined;
  TrainingRequest: undefined;
  TrainingHistory: undefined;
  InventoryRequest: undefined;
  CurrentInventory: undefined;
  Payslip: undefined;
  
  // Tasks submenu
  AssignedTasks: undefined;
  PerformanceEvaluation: undefined;
  TaskDetail: { task: any };
  
  // More submenu
  StaffDirectory: undefined;
  BulletinBoard: undefined;
  MyDocuments: undefined;
  Notifications: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Drawer = createDrawerNavigator();
const Stack = createStackNavigator<SubmenuStackParamList>();

const SubmenuStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: true }}
    >
      {/* Requests submenu */}
      <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen 
        name="LeaveHistory" 
        component={LeaveHistoryScreen} 
        options={({ navigation, route }) => ({
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate('LeaveRequest' as never)} style={{ marginRight: 12 }} accessibilityLabel="Add new leave request">
              <Icon name="plus" size={26} color="#1976D2" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="ExpenseClaim" component={ExpenseClaimScreen} />
      <Stack.Screen 
        name="ClaimsHistory" 
        component={ClaimsHistoryScreen} 
        options={({ navigation, route }) => ({
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate('ExpenseClaim' as never)} style={{ marginRight: 12 }} accessibilityLabel="Add new expense claim">
              <Icon name="plus" size={26} color="#1976D2" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="TrainingRequest" component={TrainingRequestScreen} />
      <Stack.Screen 
        name="TrainingHistory" 
        component={TrainingHistoryScreen} 
        options={({ navigation, route }) => ({
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate('TrainingRequest' as never)} style={{ marginRight: 12 }} accessibilityLabel="Add new training request">
              <Icon name="plus" size={26} color="#1976D2" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="InventoryRequest" component={InventoryRequestScreen} />
      <Stack.Screen 
        name="CurrentInventory" 
        component={CurrentInventoryScreen} 
        options={({ navigation, route }) => ({
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate('InventoryRequest' as never)} style={{ marginRight: 12 }} accessibilityLabel="Add new inventory request">
              <Icon name="plus" size={26} color="#1976D2" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="Payslip" component={PayslipScreen} />
      {/* Tasks submenu */}
      <Stack.Screen name="AssignedTasks" component={AssignedTasksScreen} />
      <Stack.Screen name="PerformanceEvaluation" component={PerformanceScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      {/* More submenu */}
      <Stack.Screen name="StaffDirectory" component={StaffDirectoryScreen} />
      <Stack.Screen name="BulletinBoard" component={BulletinsScreen} />
      <Stack.Screen name="MyDocuments" component={DocumentsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
};

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const theme = useTheme();
  const { logout } = useAuth();
  const [modal, setModal] = useState<null | 'Requests' | 'Tasks' | 'More'>(null);

  const handleTabPress = (routeName: string, isSubmenu: boolean) => {
    if (isSubmenu) {
      setModal(routeName as any);
    } else {
      setModal(null);
      navigation.navigate(routeName);
    }
  };

  const renderSubmenu = () => {
    let items: { label: string; icon: string; tab?: string; screen?: string; action?: string }[] = [];
    if (modal === 'Requests') {
      items = [
        { label: 'Attendance History', icon: 'history', tab: 'Requests', screen: 'AttendanceHistory' },
        // { label: 'Leave Request', icon: 'calendar-plus', tab: 'Requests', screen: 'LeaveRequest' },
        { label: 'Leave History', icon: 'calendar-clock', tab: 'Requests', screen: 'LeaveHistory' },
        // { label: 'Expense Claim', icon: 'cash-multiple', tab: 'Requests', screen: 'ExpenseClaim' },
        { label: 'Claims History', icon: 'file-document-multiple-outline', tab: 'Requests', screen: 'ClaimsHistory' },
        // { label: 'Training Request', icon: 'school', tab: 'Requests', screen: 'TrainingRequest' },
        { label: 'Training History', icon: 'school-outline', tab: 'Requests', screen: 'TrainingHistory' },
        // { label: 'Inventory Request', icon: 'cube-send', tab: 'Requests', screen: 'InventoryRequest' },
        { label: 'Current Inventory', icon: 'cube-outline', tab: 'Requests', screen: 'CurrentInventory' },
        { label: 'Payslip', icon: 'file-document-outline', tab: 'Requests', screen: 'Payslip' },
      ];
    } else if (modal === 'Tasks') {
      items = [
        { label: 'Assigned Tasks', icon: 'clipboard-list', tab: 'Tasks', screen: 'AssignedTasks' },
        { label: 'Performance Evaluation', icon: 'star-check', tab: 'Tasks', screen: 'PerformanceEvaluation' },
      ];
    } else if (modal === 'More') {
      items = [
        { label: 'Staff Directory', icon: 'account-group', tab: 'More', screen: 'StaffDirectory' },
        { label: 'Bulletin Board', icon: 'bullhorn', tab: 'More', screen: 'BulletinBoard' },
        { label: 'My Documents', icon: 'file-document-outline', tab: 'More', screen: 'MyDocuments' },
        { label: 'Notifications', icon: 'bell', tab: 'More', screen: 'Notifications' },
        { label: 'Logout', icon: 'logout', action: 'logout' },
      ];
    }
    return (
      <Modal isVisible={!!modal} onBackdropPress={() => setModal(null)} style={{ margin: 0 }}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.submenuCard}>
          <Pressable style={styles.closeButton} onPress={() => setModal(null)}>
            <Icon name="close" size={24} color={'#222'} />
          </Pressable>
          {items.map((item, idx) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                onPress={() => {
                  setModal(null);
                  if (item.action === 'logout') {
                    logout();
                  } else if (item.tab && item.screen) {
                    navigation.navigate(item.tab, { screen: item.screen });
                  }
                }}
                style={styles.menuItem}
              >
                <Icon
                  name={item.icon}
                  size={26}
                  color={item.action === 'logout' ? theme.colors.error : theme.colors.primary}
                  style={{ marginRight: 18 }}
                />
                <Text style={[styles.menuItemText, item.action === 'logout' && { color: theme.colors.error }]}> {item.label} </Text>
              </TouchableOpacity>
              {idx < items.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>
      </Modal>
    );
  };

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: theme.colors.surface, paddingTop: 8, paddingBottom: 8 }}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;
          const isFocused = state.index === index;
          const isSubmenu = ['Requests', 'Tasks', 'More'].includes(route.name);
          let iconName = '';
          switch (route.name) {
            case 'Dashboard':
              iconName = isFocused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Requests':
              iconName = isFocused ? 'file-document-multiple' : 'file-document-multiple-outline';
              break;
            case 'Tasks':
              iconName = isFocused ? 'clipboard-list' : 'clipboard-list-outline';
              break;
            case 'Calendar':
              iconName = isFocused ? 'calendar-month' : 'calendar-month-outline';
              break;
            case 'More':
              iconName = isFocused ? 'dots-horizontal-circle' : 'dots-horizontal-circle-outline';
              break;
            default:
              iconName = 'circle';
          }
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => handleTabPress(route.name, isSubmenu)}
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 4 }}
            >
              <Icon
                name={iconName}
                size={28}
                color={isFocused ? theme.colors.primary : (theme.colors as any).text || theme.colors.secondary}
              />
              <Text style={{ color: isFocused ? theme.colors.primary : (theme.colors as any).text || theme.colors.secondary, fontSize: 12 }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {renderSubmenu()}
    </>
  );
};

const TabNavigator: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerRight: () => (
          // @ts-ignore
          <TouchableOpacity style={{ marginRight: 16 }} onPress={() => navigation.navigate('More', { screen: 'Notifications' })}>
            <Icon name="bell-outline" size={26} color={theme.colors.primary} />
          </TouchableOpacity>
        ),
      }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Requests" component={SubmenuStackNavigator} />
      <Tab.Screen name="Tasks" component={SubmenuStackNavigator} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="More" component={SubmenuStackNavigator} />
    </Tab.Navigator>
  );
};

const MainNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Drawer.Screen name="MainTabs" component={TabNavigator} />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  submenuCard: {
    position: 'absolute',
    top: '18%',
    left: 24,
    right: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingVertical: 18,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
    alignItems: 'stretch',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 18,
    zIndex: 2,
    padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  menuItemText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 24,
  },
});

export default MainNavigator; 