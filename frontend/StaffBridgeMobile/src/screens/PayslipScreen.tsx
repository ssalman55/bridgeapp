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
        setPayslips(Array.isArray(data) ? data : []);
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

  const generatePayslipHtml = (p, user) => {
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
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>My Payroll</Title>
          <Text style={styles.subtitle}>View your salary history, payment status, and download payslips.</Text>
        </Card.Content>
      </Card>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Pay Period</Text>
        <Text style={[styles.headerCell, { flex: 2 }]}>Gross</Text>
        <Text style={[styles.headerCell, { flex: 2 }]}>Net</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Status</Text>
        <Text style={[styles.headerCell, { flex: 2 }]}>Actions</Text>
      </View>
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
          <View key={p._id || idx} style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 2 }]}>{p.payPeriod || '-'}</Text>
            <Text style={[styles.cell, { flex: 2 }]}>{p.grossSalary != null ? `€${Number(p.grossSalary).toLocaleString()}` : '-'}</Text>
            <Text style={[styles.cell, { flex: 2 }]}>{p.netSalary != null ? `€${Number(p.netSalary).toLocaleString()}` : '-'}</Text>
            <View style={[styles.cell, { flex: 1 }]}> 
              <Chip
                style={{ backgroundColor: p.paymentStatus === 'Paid' ? '#B9F6CA' : '#FFF9C4', minWidth: 70, justifyContent: 'center' }}
                textStyle={{ color: p.paymentStatus === 'Paid' ? '#388E3C' : '#8D6E63', fontWeight: 'bold', textAlign: 'center' }}
              >
                {typeof p.paymentStatus === 'string' ? p.paymentStatus : '-'}
              </Chip>
            </View>
            <View style={[styles.cell, { flex: 2 }]}> 
              <TouchableOpacity style={styles.payslipBtn} onPress={() => handleDownloadPayslip(p)}>
                <Text style={styles.payslipBtnText}>Payslip</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#888', marginBottom: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1, borderColor: '#eee' },
  headerCell: { fontWeight: 'bold', color: '#333', fontSize: 14 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#f0f0f0', backgroundColor: '#fff' },
  cell: { fontSize: 15, color: '#222', marginRight: 4 },
  payslipBtn: { backgroundColor: '#1976D2', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  payslipBtnText: { color: '#fff', fontWeight: 'bold' },
});

export default PayslipScreen; 