import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, ActivityIndicator, Chip, HelperText } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const PayslipScreen: React.FC = () => {
  const { state } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayslips = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiService.getPayslips();
        const sorted = Array.isArray(data)
          ? data.slice().sort((a, b) => (b.payPeriod || '').localeCompare(a.payPeriod || ''))
          : [];
        setPayslips(sorted);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch payslips');
      } finally {
        setLoading(false);
      }
    };
    fetchPayslips();
  }, []);

  const handleDownloadPayslip = async (payslip: any) => {
    try {
      const html = generatePayslipHtml(payslip, state.user);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate or open payslip PDF.');
    }
  };

  const generatePayslipHtml = (p: any, user: any) => {
    // You can further style this HTML as needed
    return `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; }
          .header { text-align: center; margin-bottom: 24px; }
          .title { font-size: 22px; font-weight: bold; margin-bottom: 8px; }
          .info { margin-bottom: 16px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .section { margin-bottom: 16px; }
          .label { font-weight: bold; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .table th, .table td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
          .table th { background: #f5f5f5; }
          .totals { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${user?.organizationName || 'ACS Doha International School'}</div>
          <div style="font-size:18px; font-weight:bold; margin-bottom:8px;">Monthly Payroll Payslip</div>
        </div>
        <div class="info">
          <div><span class="label">Employee Name:</span> ${user?.fullName || '-'}</div>
          <div><span class="label">Employee Number:</span> ${user?._id || '-'}</div>
          <div><span class="label">Pay Date:</span> ${p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '-'}</div>
        </div>
        <div class="section">
          <table class="table">
            <tr><th colspan="2">Payments</th><th colspan="2">Deductions</th></tr>
            <tr>
              <td>Basic Pay</td><td>${p.salaryStructure?.basicPay || '-'}</td>
              <td>Deductions</td><td>${p.deductions || '0.00'}</td>
            </tr>
            <tr>
              <td>Travel Allowance</td><td>${p.salaryStructure?.travelAllowance || '0.00'}</td>
              <td>Taxes</td><td>${p.taxes || '0.00'}</td>
            </tr>
            <tr>
              <td>Housing Allowance</td><td>${p.salaryStructure?.housingAllowance || '0.00'}</td>
              <td></td><td></td>
            </tr>
            <tr>
              <td>Utility Allowance</td><td>${p.salaryStructure?.utilityAllowance || '0.00'}</td>
              <td></td><td></td>
            </tr>
            <tr>
              <td>Bonus</td><td>${p.bonus || '0.00'}</td>
              <td></td><td></td>
            </tr>
            <tr>
              <td>Reimbursements</td><td>${p.reimbursements || '0.00'}</td>
              <td></td><td></td>
            </tr>
            <tr class="totals">
              <td>Total Payments</td><td>${p.grossSalary || '-'}</td>
              <td>Total Deductions</td><td>${p.deductions || '0.00'}</td>
            </tr>
          </table>
        </div>
        <div class="section">
          <div class="row"><span class="label">NET PAY:</span> <span>${p.netSalary || '-'}</span></div>
          <div class="row"><span class="label">Payment Status:</span> <span>${p.paymentStatus || '-'}</span></div>
          <div class="row"><span class="label">Payment Method:</span> <span>${p.paymentMethod || '-'}</span></div>
        </div>
        <div class="section" style="font-size:12px; color:#888; text-align:center; margin-top:24px;">
          This is a system-generated payslip.
        </div>
      </body>
      </html>
    `;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>My Payslips</Text>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
      ) : error ? (
        <HelperText type="error" visible style={{ textAlign: 'center', marginTop: 32 }}>{error}</HelperText>
      ) : payslips.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 32, color: theme.colors.textSecondary }}>
          No payslips found.
        </Text>
      ) : (
        payslips.map((p, idx) => (
          <View key={p._id || idx} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.payPeriodLabel}>Pay Period</Text>
              <Text style={styles.payPeriod}>{p.payPeriod || '-'}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.label}>Gross Salary</Text>
              <Text style={styles.value}>{p.grossSalary != null ? `€${Number(p.grossSalary).toLocaleString()}` : '-'}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.label}>Net Salary</Text>
              <Text style={styles.value}>{p.netSalary != null ? `€${Number(p.netSalary).toLocaleString()}` : '-'}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.label}>Status</Text>
              <View style={[styles.badge, p.paymentStatus === 'Paid' ? styles.badgePaid : p.paymentStatus === 'Pending' ? styles.badgePending : styles.badgeFailed]}>
                <Text style={[styles.badgeText, p.paymentStatus === 'Paid' ? styles.badgeTextPaid : p.paymentStatus === 'Pending' ? styles.badgeTextPending : styles.badgeTextFailed]}>
                  {typeof p.paymentStatus === 'string' ? p.paymentStatus : '-'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.payslipBtn} onPress={() => handleDownloadPayslip(p)}>
              <Text style={styles.payslipBtnText}>📄 View Payslip</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 18, color: '#222' },
  card: { borderRadius: 18, padding: 18, marginBottom: 18, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  payPeriodLabel: { fontSize: 14, color: '#888', fontWeight: '500' },
  payPeriod: { fontSize: 16, fontWeight: 'bold', color: '#1976D2' },
  label: { fontSize: 15, color: '#555', fontWeight: '500' },
  value: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  badge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start' },
  badgePaid: { backgroundColor: '#B9F6CA' },
  badgePending: { backgroundColor: '#FFF9C4' },
  badgeFailed: { backgroundColor: '#FFCDD2' },
  badgeText: { fontWeight: 'bold', fontSize: 13 },
  badgeTextPaid: { color: '#388E3C' },
  badgeTextPending: { color: '#8D6E63' },
  badgeTextFailed: { color: '#C62828' },
  payslipBtn: { backgroundColor: '#1976D2', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  payslipBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default PayslipScreen; 