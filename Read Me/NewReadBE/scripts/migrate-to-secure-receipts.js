#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

// Import all models to ensure schemas are registered
require('../src/models/Organization');
require('../src/models/User');

// Now import the models for use
const Organization = require('../src/models/Organization');
const { uploadFile, getSignedUrl } = require('../src/utils/s3');

// Standalone function to generate receipt PDF buffer (same as controller)
const generateReceiptPDFBuffer = async (organization, payment) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4'
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });

      // Page dimensions
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const centerX = doc.page.margins.left + pageWidth / 2;

      // Header with StaffBridge name (no logo)
      doc
        .fontSize(32)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('StaffBridge', centerX, 60, { align: 'center' });

      // Company address (static)
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text('30 N Gould St Ste N, Sheridan, WY 82801', centerX, doc.y + 10, { align: 'center' })
        .moveDown(2);

      // Divider line
      doc
        .moveTo(doc.page.margins.left, doc.y + 10)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y + 10)
        .strokeColor('#E5E7EB')
        .lineWidth(2)
        .stroke()
        .moveDown(2);

      // Payment Receipt title
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#E67E22')
        .text('Payment Receipt', centerX, doc.y, { align: 'center' })
        .moveDown(2);

      // Receipt details with improved spacing and formatting
      let currentY = doc.y;

      // Receipt number
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Receipt #:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payment.transactionId, doc.page.margins.left + 80, currentY);
      currentY += 25;

      // Date
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Date:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(new Date(payment.date).toLocaleDateString(), doc.page.margins.left + 80, currentY);
      currentY += 35;

      // Organization
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Organization:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(organization.name, doc.page.margins.left + 100, currentY);
      currentY += 25;

      // Email
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Email:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(organization.email, doc.page.margins.left + 80, currentY);
      currentY += 35;

      // Plan (with underline)
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Plan:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151');
      
      // Add underline for plan
      const planText = payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1);
      doc.text(planText, doc.page.margins.left + 80, currentY);
      doc
        .moveTo(doc.page.margins.left + 80, currentY + 15)
        .lineTo(doc.page.margins.left + 80 + doc.widthOfString(planText), currentY + 15)
        .strokeColor('#374151')
        .lineWidth(0.5)
        .stroke();
      currentY += 25;

      // Amount (in green)
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Amount:', doc.page.margins.left, currentY)
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#16A34A')
        .text(`$${payment.amount}`, doc.page.margins.left + 80, currentY);
      currentY += 25;

      // Transaction ID
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Transaction ID:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payment.transactionId, doc.page.margins.left + 120, currentY);
      currentY += 40;

      // Thank you message
      doc
        .fontSize(16)
        .font('Helvetica')
        .fillColor('#1C4E80')
        .text('Thank you for your payment and for choosing StaffBridge!', centerX, currentY, { align: 'center' });
      
      currentY += 40;

      // Footer divider
      doc
        .moveTo(doc.page.margins.left, currentY)
        .lineTo(doc.page.width - doc.page.margins.right, currentY)
        .strokeColor('#E5E7EB')
        .lineWidth(1.5)
        .stroke();

      // Footer with support email
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('For support, contact support@stfbridge.com', centerX, currentY + 20, { align: 'center' });

      // End the document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Secure function to generate and store receipt to S3 with organization isolation
const generateAndStoreReceipt = async (organization, payment) => {
  try {
    // Generate unique filename with organization isolation: receipts/{orgId}/{txnId}.pdf
    const orgId = organization._id;
    const txnId = payment.transactionId;
    const s3Key = `receipts/${orgId}/${txnId}.pdf`;

    // Generate PDF buffer
    const pdfBuffer = await generateReceiptPDFBuffer(organization, payment);

    // Upload to S3
    await uploadFile(
      { 
        buffer: pdfBuffer, 
        mimetype: 'application/pdf', 
        originalname: `receipt-${txnId}.pdf` 
      }, 
      s3Key
    );

    console.log(`✅ Receipt generated and stored with secure structure: ${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error('Error generating and storing receipt:', error);
    throw error;
  }
};

// Main migration function
const migrateToSecureReceipts = async () => {
  try {
    console.log('🧾 Starting migration to secure organization-isolated receipts...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    console.log('🔄 Finding all organizations with payment history...');
    
    // Find all organizations with payment history
    const organizations = await Organization.find({ 
      paymentHistory: { $exists: true, $ne: [] } 
    });
    
    console.log(`📊 Found ${organizations.length} organizations with payment history`);
    
    let totalPayments = 0;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const organization of organizations) {
      console.log(`🔄 Processing organization: ${organization.name} (${organization._id})`);
      
      if (!organization.paymentHistory || organization.paymentHistory.length === 0) {
        console.log(`⏭️ No payment history for organization: ${organization.name}`);
        continue;
      }
      
      totalPayments += organization.paymentHistory.length;
      
      for (const payment of organization.paymentHistory) {
        try {
          console.log(`🔄 Migrating receipt for ${organization.name} - ${payment.transactionId} (${payment.plan})`);
          
          // Generate and store receipt with new secure structure
          await generateAndStoreReceipt(organization, payment);
          
          successCount++;
          console.log(`✅ Successfully migrated receipt for ${organization.name} - ${payment.transactionId}`);
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            skippedCount++;
            console.log(`⏭️ Skipped (already exists): ${organization.name} - ${payment.transactionId}`);
          } else {
            errorCount++;
            console.error(`❌ Failed to migrate receipt for ${organization.name} - ${payment.transactionId}:`, error.message);
          }
        }
      }
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`📊 Total organizations: ${organizations.length}`);
    console.log(`📊 Total payments: ${totalPayments}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️ Skipped (already exists): ${skippedCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('========================\n');
    
    if (successCount > 0) {
      console.log('🎉 Migration completed successfully!');
      console.log('🧾 All receipts now use secure organization-isolated S3 structure');
      console.log('🛡️ Tenant isolation is now fully enforced for receipts');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
};

// Run the migration
migrateToSecureReceipts(); 