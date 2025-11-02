/**
 * Intelligent Recommendations Engine
 * Analyzes HR analytics data and generates actionable insights
 */

/**
 * Generate intelligent recommendations based on analytics data
 * @param {Object} analyticsData - The analytics data from head office dashboard
 * @returns {Array} Array of recommendation objects
 */
let DEFAULT_CURRENCY = 'USD';

function generateIntelligentRecommendations(analyticsData, options = {}) {
  if (options && options.currency) {
    DEFAULT_CURRENCY = options.currency;
  }
  const recommendations = [];
  const { networkSummary, branches, headOffice } = analyticsData;

  // 1. ATTENDANCE ANALYSIS
  const avgAttendance = networkSummary?.averageNetworkAttendance || 0;
  if (avgAttendance < 85) {
    const lowAttendanceBranches = branches.filter(b => 
      b.attendanceAnalytics?.averageAttendance < 80
    );
    
    recommendations.push({
      id: 'attendance-optimization',
      type: 'performance',
      category: 'attendance',
      title: 'Attendance Optimization Opportunity',
      icon: 'FiTrendingUp',
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      priority: 'high',
      impact: 'high',
      confidence: calculateConfidence(avgAttendance, 85),
      message: `Network attendance is ${avgAttendance}%. ${lowAttendanceBranches.length > 0 ? `${lowAttendanceBranches.length} branch(es) below 80%: ${lowAttendanceBranches.map(b => b.name).join(', ')}` : 'Consider implementing flexible work arrangements.'}`,
      recommendation: 'Implement flexible work arrangements and remote options to improve attendance rates',
      estimatedImprovement: '12-15% attendance increase',
      estimatedSavings: formatCurrency(calculateAttendanceSavings(networkSummary.totalPayrollAmount, avgAttendance)),
      implementationEffort: 'Medium',
      implementationTime: '4-6 weeks',
      affectedBranches: lowAttendanceBranches.map(b => b.name),
      actionItems: [
        'Conduct attendance surveys',
        'Implement flexible work hours',
        'Offer remote work options',
        'Review attendance policies'
      ]
    });
  }

  // 2. TRAINING COST ANALYSIS
  const totalPayroll = networkSummary?.totalPayrollAmount || 0;
  const totalTrainingCost = networkSummary?.totalTrainingCost || 0;
  const trainingCostRatio = totalPayroll > 0 ? totalTrainingCost / totalPayroll : 0;
  
  if (trainingCostRatio > 0.1 && totalTrainingCost > 0) {
    recommendations.push({
      id: 'training-cost-optimization',
      type: 'cost',
      category: 'training',
      title: 'Training Cost Optimization',
      icon: 'FiDollarSign',
      color: 'green',
      gradient: 'from-green-500 to-green-600',
      priority: 'medium',
      impact: 'medium',
      confidence: calculateConfidence(trainingCostRatio, 0.1),
      message: `Training costs represent ${(trainingCostRatio * 100).toFixed(1)}% of total payroll (${formatCurrency(totalTrainingCost)})`,
      recommendation: 'Consolidate training programs across branches to reduce costs',
      estimatedSavings: formatCurrency(totalTrainingCost * 0.15),
      estimatedImprovement: '15% cost reduction',
      implementationEffort: 'Low',
      implementationTime: '2-3 weeks',
      affectedBranches: branches.map(b => b.name),
      actionItems: [
        'Audit current training programs',
        'Identify duplicate programs',
        'Create centralized training platform',
        'Negotiate bulk training discounts'
      ]
    });
  }

  // 3. HELPDESK SATISFACTION ANALYSIS
  const avgSatisfaction = networkSummary?.averageHelpdeskSatisfaction || 0;
  const lowSatisfactionBranches = branches.filter(b => 
    (b.helpdeskAnalytics?.satisfactionScore || 0) < 70
  );
  
  if (lowSatisfactionBranches.length > 0) {
    recommendations.push({
      id: 'helpdesk-satisfaction-alert',
      type: 'risk',
      category: 'helpdesk',
      title: 'Helpdesk Satisfaction Alert',
      icon: 'FiAlertCircle',
      color: 'orange',
      gradient: 'from-orange-500 to-orange-600',
      priority: 'urgent',
      impact: 'high',
      confidence: 95,
      message: `${lowSatisfactionBranches.length} branch(es) have satisfaction below 70%: ${lowSatisfactionBranches.map(b => b.name).join(', ')}`,
      recommendation: 'Conduct satisfaction surveys and improve response times',
      estimatedImprovement: '20-30% satisfaction increase',
      estimatedSavings: formatCurrency(calculateSatisfactionImpact(networkSummary.totalUsers)),
      implementationEffort: 'High',
      implementationTime: '6-8 weeks',
      affectedBranches: lowSatisfactionBranches.map(b => b.name),
      actionItems: [
        'Survey affected branches',
        'Analyze ticket resolution times',
        'Train helpdesk staff',
        'Implement SLA standards',
        'Monitor satisfaction weekly'
      ]
    });
  }

  // 4. PERFORMANCE ANALYSIS
  const avgPerformance = networkSummary?.averagePerformanceRating || 0;
  const performanceGap = avgPerformance - 4.0;
  
  if (performanceGap < -0.5) {
    const lowPerformers = branches.filter(b => 
      (b.performanceAnalytics?.averageRating || 0) < 3.5
    );
    
    recommendations.push({
      id: 'performance-improvement',
      type: 'performance',
      category: 'performance',
      title: 'Performance Improvement Needed',
      icon: 'FiTarget',
      color: 'indigo',
      gradient: 'from-indigo-500 to-indigo-600',
      priority: 'high',
      impact: 'high',
      confidence: calculateConfidence(avgPerformance, 4.0),
      message: `Average performance rating is ${avgPerformance.toFixed(1)}/5. ${lowPerformers.length > 0 ? `${lowPerformers.length} branch(es) below 3.5: ${lowPerformers.map(b => b.name).join(', ')}` : 'Consider targeted development programs.'}`,
      recommendation: 'Implement targeted coaching and development programs',
      estimatedImprovement: '0.5-0.8 rating increase',
      estimatedSavings: formatCurrency(calculatePerformanceImpact(totalPayroll)),
      implementationEffort: 'Medium',
      implementationTime: '8-12 weeks',
      affectedBranches: lowPerformers.map(b => b.name),
      actionItems: [
        'Identify skill gaps',
        'Create development plans',
        'Assign mentors',
        'Track progress monthly',
        'Recognize improvements'
      ]
    });
  }

  // 5. EMPLOYEE ENGAGEMENT ANALYSIS
  const totalRecognitions = networkSummary?.totalRecognitions || 0;
  const totalUsers = networkSummary?.totalUsers || 0;
  const recognitionRate = totalUsers > 0 ? totalRecognitions / totalUsers : 0;
  
  if (recognitionRate < 2) {
    recommendations.push({
      id: 'employee-engagement',
      type: 'engagement',
      category: 'recognition',
      title: 'Employee Engagement Opportunity',
      icon: 'FiUsers',
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      priority: 'medium',
      impact: 'high',
      confidence: calculateConfidence(recognitionRate, 2),
      message: `Recognition rate is ${recognitionRate.toFixed(1)} per employee. Low engagement detected.`,
      recommendation: 'Increase recognition programs and monthly appreciation events',
      estimatedImprovement: '40% higher engagement',
      estimatedSavings: formatCurrency(calculateEngagementImpact(totalPayroll)),
      implementationEffort: 'Low',
      implementationTime: '2-4 weeks',
      affectedBranches: branches.map(b => b.name),
      actionItems: [
        'Launch monthly recognition program',
        'Create peer recognition system',
        'Celebrate achievements publicly',
        'Track engagement metrics'
      ]
    });
  }

  // 6. PAYROLL EFFICIENCY ANALYSIS
  const avgSalary = networkSummary?.averageSalary || 0;
  const totalPayrollAmount = networkSummary?.totalPayrollAmount || 0;
  
  if (totalPayrollAmount > 0 && avgSalary > 0) {
    const payrollEfficiency = calculatePayrollEfficiency(totalPayrollAmount, totalUsers);
    
    if (payrollEfficiency < 0.7) {
      recommendations.push({
        id: 'payroll-efficiency',
        type: 'cost',
        category: 'payroll',
        title: 'Payroll Efficiency Opportunity',
        icon: 'FiBarChart2',
        color: 'teal',
        gradient: 'from-teal-500 to-teal-600',
        priority: 'medium',
        impact: 'medium',
        confidence: calculateConfidence(payrollEfficiency, 0.7),
        message: `Payroll efficiency is ${(payrollEfficiency * 100).toFixed(0)}%. Consider optimizing salary structures.`,
        recommendation: 'Review and optimize salary structures across branches',
        estimatedSavings: formatCurrency(totalPayrollAmount * 0.05),
        estimatedImprovement: '5% efficiency gain',
        implementationEffort: 'High',
        implementationTime: '12-16 weeks',
        affectedBranches: branches.map(b => b.name),
        actionItems: [
          'Conduct salary benchmarking',
          'Review pay scales',
          'Identify pay gaps',
          'Create compensation guidelines',
          'Implement gradually'
        ]
      });
    }
  }

  // 7. LEAVE MANAGEMENT ANALYSIS
  const totalLeaveRequests = networkSummary?.totalLeaveRequests || 0;
  const approvedLeaveRequests = networkSummary?.approvedLeaveRequests || 0;
  const approvalRate = totalLeaveRequests > 0 ? approvedLeaveRequests / totalLeaveRequests : 0;
  
  if (approvalRate < 0.7) {
    recommendations.push({
      id: 'leave-management',
      type: 'process',
      category: 'leave',
      title: 'Leave Management Optimization',
      icon: 'FiClock',
      color: 'pink',
      gradient: 'from-pink-500 to-pink-600',
      priority: 'low',
      impact: 'medium',
      confidence: calculateConfidence(approvalRate, 0.7),
      message: `Leave approval rate is ${(approvalRate * 100).toFixed(0)}%. ${totalLeaveRequests - approvedLeaveRequests} requests pending.`,
      recommendation: 'Streamline leave approval process and reduce bottlenecks',
      estimatedImprovement: '30% faster approvals',
      estimatedSavings: formatCurrency(calculateLeaveEfficiencySavings(totalUsers)),
      implementationEffort: 'Low',
      implementationTime: '2-3 weeks',
      affectedBranches: branches.map(b => b.name),
      actionItems: [
        'Automate leave approvals',
        'Set up approval workflows',
        'Train managers on process',
        'Monitor approval times'
      ]
    });
  }

  // 8. ASSET UTILIZATION ANALYSIS
  const totalAssets = networkSummary?.totalAssets || 0;
  const assignedAssets = networkSummary?.assignedAssets || 0;
  const assetUtilization = totalAssets > 0 ? assignedAssets / totalAssets : 0;
  
  if (assetUtilization < 0.6) {
    recommendations.push({
      id: 'asset-utilization',
      type: 'efficiency',
      category: 'assets',
      title: 'Asset Utilization Opportunity',
      icon: 'FiPackage',
      color: 'amber',
      gradient: 'from-amber-500 to-amber-600',
      priority: 'low',
      impact: 'low',
      confidence: calculateConfidence(assetUtilization, 0.6),
      message: `Asset utilization is ${(assetUtilization * 100).toFixed(0)}%. ${totalAssets - assignedAssets} assets unassigned.`,
      recommendation: 'Optimize asset allocation and reduce idle inventory',
      estimatedSavings: formatCurrency(calculateAssetSavings(totalAssets - assignedAssets)),
      estimatedImprovement: '20% better utilization',
      implementationEffort: 'Low',
      implementationTime: '1-2 weeks',
      affectedBranches: branches.map(b => b.name),
      actionItems: [
        'Audit unassigned assets',
        'Reallocate to branches',
        'Sell unused assets',
        'Update asset tracking'
      ]
    });
  }

  // Sort recommendations by priority and impact
  return recommendations.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const impactOrder = { high: 0, medium: 1, low: 2 };
    
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    
    return impactOrder[a.impact] - impactOrder[b.impact];
  });
}

/**
 * Calculate confidence score based on deviation from target
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @returns {number} Confidence score (0-100)
 */
function calculateConfidence(current, target) {
  const deviation = Math.abs(current - target);
  const maxDeviation = target * 0.5; // Assume 50% deviation is max
  const confidence = Math.max(0, Math.min(100, 100 - (deviation / maxDeviation) * 100));
  return Math.round(confidence);
}

/**
 * Calculate attendance savings
 * @param {number} totalPayroll - Total payroll amount
 * @param {number} attendance - Current attendance percentage
 * @returns {number} Estimated savings
 */
function calculateAttendanceSavings(totalPayroll, attendance) {
  const improvement = 0.12; // 12% improvement
  const newAttendance = Math.min(100, attendance + (attendance * improvement));
  const productivityGain = (newAttendance - attendance) / 100;
  return totalPayroll * productivityGain * 0.5; // 50% of productivity gain
}

/**
 * Calculate satisfaction impact
 * @param {number} totalUsers - Total number of users
 * @returns {number} Estimated impact value
 */
function calculateSatisfactionImpact(totalUsers) {
  // Higher satisfaction = lower turnover = lower recruitment costs
  const avgRecruitmentCost = 5000; // $5,000 per hire
  const turnoverReduction = 0.05; // 5% reduction
  return totalUsers * turnoverReduction * avgRecruitmentCost;
}

/**
 * Calculate performance impact
 * @param {number} totalPayroll - Total payroll amount
 * @returns {number} Estimated impact value
 */
function calculatePerformanceImpact(totalPayroll) {
  // Better performance = higher productivity
  const productivityGain = 0.08; // 8% productivity increase
  return totalPayroll * productivityGain;
}

/**
 * Calculate engagement impact
 * @param {number} totalPayroll - Total payroll amount
 * @returns {number} Estimated impact value
 */
function calculateEngagementImpact(totalPayroll) {
  // Higher engagement = lower turnover and higher productivity
  const productivityGain = 0.06; // 6% productivity increase
  return totalPayroll * productivityGain;
}

/**
 * Calculate payroll efficiency
 * @param {number} totalPayroll - Total payroll amount
 * @param {number} totalUsers - Total number of users
 * @returns {number} Efficiency score (0-1)
 */
function calculatePayrollEfficiency(totalPayroll, totalUsers) {
  if (totalUsers === 0) return 0;
  const avgSalary = totalPayroll / totalUsers;
  const industryAvg = 4500; // Industry average monthly salary
  const efficiency = industryAvg / avgSalary;
  return Math.min(1, Math.max(0, efficiency));
}

/**
 * Calculate leave efficiency savings
 * @param {number} totalUsers - Total number of users
 * @returns {number} Estimated savings
 */
function calculateLeaveEfficiencySavings(totalUsers) {
  const avgProcessingTime = 2; // hours
  const avgHourlyRate = 50; // $50/hour
  const timeSaved = 0.3; // 30% time saved
  return totalUsers * avgProcessingTime * avgHourlyRate * timeSaved;
}

/**
 * Calculate asset savings
 * @param {number} unassignedAssets - Number of unassigned assets
 * @returns {number} Estimated savings
 */
function calculateAssetSavings(unassignedAssets) {
  const avgAssetValue = 1000; // $1,000 per asset
  const utilizationRate = 0.5; // 50% utilization
  return unassignedAssets * avgAssetValue * utilizationRate;
}

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

module.exports = {
  generateIntelligentRecommendations
};






