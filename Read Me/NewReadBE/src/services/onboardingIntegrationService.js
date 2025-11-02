const crypto = require('crypto');

/**
 * Mock E-signature Service
 * In production, replace with real providers like DocuSign, HelloSign, Adobe Sign
 */
class ESignatureService {
  constructor(provider = 'mock') {
    this.provider = provider;
  }

  async createEnvelope(document, signers, options = {}) {
    // Mock implementation - replace with real provider API
    const envelopeId = `env_${crypto.randomBytes(16).toString('hex')}`;
    
    console.log(`[MOCK E-SIGN] Creating envelope for document: ${document.name}`);
    console.log(`[MOCK E-SIGN] Signers: ${signers.map(s => s.email).join(', ')}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      envelopeId,
      status: 'created',
      signers: signers.map(signer => ({
        ...signer,
        status: 'pending',
        signUrl: `${process.env.FRONTEND_URL}/sign/${envelopeId}/${signer.email}`
      }))
    };
  }

  async sendEnvelope(envelopeId) {
    console.log(`[MOCK E-SIGN] Sending envelope: ${envelopeId}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      envelopeId,
      status: 'sent',
      sentAt: new Date().toISOString()
    };
  }

  async getEnvelopeStatus(envelopeId) {
    console.log(`[MOCK E-SIGN] Getting status for envelope: ${envelopeId}`);
    
    // Mock random status progression
    const statuses = ['sent', 'delivered', 'signed', 'completed'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      envelopeId,
      status: randomStatus,
      lastModified: new Date().toISOString()
    };
  }

  async voidEnvelope(envelopeId, reason) {
    console.log(`[MOCK E-SIGN] Voiding envelope: ${envelopeId}, reason: ${reason}`);
    
    return {
      envelopeId,
      status: 'voided',
      voidReason: reason
    };
  }
}

/**
 * Mock Identity Provisioning Service
 * In production, integrate with Active Directory, Okta, Azure AD, etc.
 */
class IdentityProvisioningService {
  constructor(provider = 'mock') {
    this.provider = provider;
  }

  async createUserAccount(userData) {
    const { firstName, lastName, email, department, role, manager } = userData;
    
    console.log(`[MOCK IDENTITY] Creating account for: ${firstName} ${lastName} (${email})`);
    
    // Mock account creation
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      username,
      temporaryPassword,
      accountId: `usr_${crypto.randomBytes(8).toString('hex')}`,
      groups: [department, role],
      message: 'Account created successfully. User will receive credentials via email.'
    };
  }

  async assignGroups(username, groups) {
    console.log(`[MOCK IDENTITY] Assigning groups to ${username}: ${groups.join(', ')}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      username,
      assignedGroups: groups,
      message: 'Groups assigned successfully'
    };
  }

  async provisionEmail(userData) {
    const { firstName, lastName, email, department } = userData;
    
    console.log(`[MOCK IDENTITY] Provisioning email for: ${email}`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      email,
      mailboxId: `mb_${crypto.randomBytes(8).toString('hex')}`,
      aliases: [`${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`],
      message: 'Email account provisioned successfully'
    };
  }

  async revokeAccess(username) {
    console.log(`[MOCK IDENTITY] Revoking access for: ${username}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      username,
      message: 'Access revoked successfully'
    };
  }
}

/**
 * Mock Equipment Management Service
 * In production, integrate with asset management systems
 */
class EquipmentService {
  constructor() {
    this.mockInventory = [
      { id: 'laptop-001', name: 'MacBook Pro 16"', category: 'laptop', available: true },
      { id: 'laptop-002', name: 'Dell XPS 13', category: 'laptop', available: true },
      { id: 'monitor-001', name: 'Dell 27" Monitor', category: 'monitor', available: true },
      { id: 'phone-001', name: 'iPhone 14', category: 'phone', available: false },
      { id: 'keyboard-001', name: 'Mechanical Keyboard', category: 'accessory', available: true }
    ];
  }

  async getAvailableEquipment(category = null) {
    console.log(`[MOCK EQUIPMENT] Getting available equipment${category ? ` for category: ${category}` : ''}`);
    
    let equipment = this.mockInventory.filter(item => item.available);
    
    if (category) {
      equipment = equipment.filter(item => item.category === category);
    }
    
    return equipment;
  }

  async reserveEquipment(equipmentIds, assigneeEmail) {
    console.log(`[MOCK EQUIPMENT] Reserving equipment for: ${assigneeEmail}`);
    console.log(`[MOCK EQUIPMENT] Equipment IDs: ${equipmentIds.join(', ')}`);
    
    const reservationId = `res_${crypto.randomBytes(8).toString('hex')}`;
    
    // Update mock inventory
    equipmentIds.forEach(id => {
      const item = this.mockInventory.find(item => item.id === id);
      if (item) {
        item.available = false;
        item.reservedFor = assigneeEmail;
        item.reservedAt = new Date();
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      reservationId,
      equipmentIds,
      assignee: assigneeEmail,
      status: 'reserved',
      message: 'Equipment reserved successfully'
    };
  }

  async issueEquipment(reservationId, recipientSignature) {
    console.log(`[MOCK EQUIPMENT] Issuing equipment for reservation: ${reservationId}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      reservationId,
      status: 'issued',
      issuedAt: new Date(),
      recipientSignature,
      message: 'Equipment issued successfully'
    };
  }

  async returnEquipment(equipmentIds, condition, notes) {
    console.log(`[MOCK EQUIPMENT] Processing return for equipment: ${equipmentIds.join(', ')}`);
    
    // Update mock inventory
    equipmentIds.forEach(id => {
      const item = this.mockInventory.find(item => item.id === id);
      if (item) {
        item.available = true;
        delete item.reservedFor;
        delete item.reservedAt;
        item.lastReturnCondition = condition;
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return {
      equipmentIds,
      status: 'returned',
      returnedAt: new Date(),
      condition,
      notes,
      message: 'Equipment returned successfully'
    };
  }
}

/**
 * Mock Training/LMS Integration Service
 */
class TrainingService {
  constructor(provider = 'mock') {
    this.provider = provider;
  }

  async enrollInCourse(userEmail, courseId, courseName) {
    console.log(`[MOCK TRAINING] Enrolling ${userEmail} in course: ${courseName} (${courseId})`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const enrollmentId = `enr_${crypto.randomBytes(8).toString('hex')}`;
    
    return {
      enrollmentId,
      courseId,
      courseName,
      userEmail,
      status: 'enrolled',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      accessUrl: `${process.env.FRONTEND_URL}/training/course/${courseId}`,
      message: 'Successfully enrolled in course'
    };
  }

  async getEnrollmentStatus(enrollmentId) {
    console.log(`[MOCK TRAINING] Getting enrollment status: ${enrollmentId}`);
    
    const statuses = ['enrolled', 'in-progress', 'completed', 'overdue'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      enrollmentId,
      status: randomStatus,
      progress: Math.floor(Math.random() * 100),
      lastAccessed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    };
  }

  async getMandatoryCourses(department, role) {
    console.log(`[MOCK TRAINING] Getting mandatory courses for ${department}/${role}`);
    
    const mandatoryCourses = [
      {
        id: 'safety-101',
        name: 'Workplace Safety Fundamentals',
        department: 'all',
        estimatedHours: 2,
        priority: 'high'
      },
      {
        id: 'compliance-001',
        name: 'Code of Conduct & Ethics',
        department: 'all',
        estimatedHours: 1.5,
        priority: 'high'
      },
      {
        id: 'security-awareness',
        name: 'Information Security Awareness',
        department: 'all',
        estimatedHours: 1,
        priority: 'medium'
      },
      {
        id: 'hr-policies',
        name: 'HR Policies and Procedures',
        department: department,
        estimatedHours: 1,
        priority: 'medium'
      }
    ];
    
    return mandatoryCourses.filter(course => 
      course.department === 'all' || course.department === department
    );
  }
}

/**
 * Mock Notification Service
 */
class NotificationService {
  async sendEmail(to, subject, template, data = {}) {
    console.log(`[MOCK EMAIL] Sending email to: ${to}`);
    console.log(`[MOCK EMAIL] Subject: ${subject}`);
    console.log(`[MOCK EMAIL] Template: ${template}`);
    
    // Simulate email delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      messageId: `msg_${crypto.randomBytes(8).toString('hex')}`,
      status: 'sent',
      to,
      subject,
      sentAt: new Date()
    };
  }

  async sendSMS(to, message) {
    console.log(`[MOCK SMS] Sending SMS to: ${to}`);
    console.log(`[MOCK SMS] Message: ${message}`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      messageId: `sms_${crypto.randomBytes(8).toString('hex')}`,
      status: 'sent',
      to,
      sentAt: new Date()
    };
  }
}

/**
 * Mock Webhook Service
 */
class WebhookService {
  async sendWebhook(url, payload, headers = {}) {
    console.log(`[MOCK WEBHOOK] Sending webhook to: ${url}`);
    console.log(`[MOCK WEBHOOK] Payload:`, JSON.stringify(payload, null, 2));
    
    // Simulate webhook delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock successful response
    return {
      status: 200,
      response: { received: true, timestamp: new Date() },
      sentAt: new Date()
    };
  }
}

module.exports = {
  ESignatureService,
  IdentityProvisioningService,
  EquipmentService,
  TrainingService,
  NotificationService,
  WebhookService
};







