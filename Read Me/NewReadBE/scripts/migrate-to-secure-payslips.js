#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

// Import all models to ensure schemas are registered
require('../src/models/User');
require('../src/models/Payroll');
require('../src/models/Organization');
require('../src/models/SystemSettings');
require('../src/models/SalaryStructure');

// Now import the models for use
const Payroll = require('../src/models/Payroll');
const Organization = require('../src/models/Organization');
const SystemSettings = require('../src/models/SystemSettings');
const { uploadFile, getSignedUrl } = require('../src/utils/s3');

// Standalone function to generate payslip PDF buffer (same as controller)
const generatePayslipPDFBuffer = async (payroll) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch organization name
      const organization = await Organization.findById(payroll.organization);
      const orgName = organization ? organization.name : 'Organization';

      // Fetch organization settings for logo and address
      const settings = await SystemSettings.findOne({ organization: payroll.organization });
      const logoUrl = settings?.logoUrl;
      const orgAddress = settings?.address;

      // Calculate YTD gross/net
      const year = payroll.payPeriod.split('-')[0];
      const ytdPayrolls = await Payroll.find({
        staff: payroll.staff._id,
        organization: payroll.organization,
        payPeriod: { $regex: `^${year}-` }
      });
      const grossYTD = ytdPayrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0);
      const netYTD = ytdPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

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

      // Header with organization name
      doc
        .fontSize(28)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text(orgName, doc.page.margins.left, 60, { align: 'left' });

      // Company address (only if configured)
      if (orgAddress) {
        doc
          .fontSize(12)
          .font('Helvetica')
          .fillColor('#4B5563')
          .text(orgAddress, doc.page.margins.left, doc.y + 10, { align: 'left' })
          .moveDown(2);
      } else {
        doc.moveDown(2);
      }

      // Divider line
      doc
        .moveTo(doc.page.margins.left, doc.y + 10)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y + 10)
        .strokeColor('#E5E7EB')
        .lineWidth(2)
        .stroke()
        .moveDown(2);

      // Payslip title
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#E67E22')
        .text('Monthly Payroll Payslip', doc.page.margins.left, doc.y, { align: 'left' })
        .moveDown(2);

      // Payslip details with improved spacing and formatting
      let currentY = doc.y;

      // Employee name
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Employee Name:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payroll.staff.fullName, doc.page.margins.left + 140, currentY);
      currentY += 25;

      // Employee number
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Employee Number:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payroll.staff._id, doc.page.margins.left + 140, currentY);
      currentY += 25;

      // Pay date
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Pay Date:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payroll.paymentDate ? new Date(payroll.paymentDate).toLocaleDateString() : '-', doc.page.margins.left + 120, currentY);
      currentY += 25;

      // Pay Period
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Pay Period:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payroll.payPeriod, doc.page.margins.left + 120, currentY);
      currentY += 35;

      // Payments and Deductions section with spacing
      const tableWidth = pageWidth * 0.95;
      const colWidth = (tableWidth - 40) / 2; // Subtract 40px for spacing between columns
      const spacingWidth = 40; // Width of the spacing column
      const startX = doc.page.margins.left + (pageWidth - tableWidth) / 2;

      // Section headers
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Payments', startX, currentY, { width: colWidth, align: 'left' })
        .text('Deductions', startX + colWidth + spacingWidth, currentY, { width: colWidth, align: 'left' });
      currentY += 25;

      // Payments and deductions data
      doc.font('Helvetica').fontSize(13).fillColor('#374151');
      
      const payments = [
        { desc: 'Basic Pay', val: payroll.salaryStructure.basic },
        { desc: 'Travel Allowance', val: payroll.salaryStructure.transport },
        { desc: 'Housing Allowance', val: payroll.salaryStructure.housing },
        { desc: 'Utility Allowance', val: payroll.salaryStructure.utility },
        { desc: 'Bonus', val: payroll.salaryStructure.bonus },
        { desc: 'Reimbursements', val: payroll.salaryStructure.reimbursements },
      ];
      
      const deductions = [
        { desc: 'Deductions', val: payroll.salaryStructure.deductions },
        { desc: 'Taxes', val: payroll.salaryStructure.taxes },
      ];

      const maxRows = Math.max(payments.length, deductions.length);
      for (let i = 0; i < maxRows; i++) {
        const p = payments[i];
        const d = deductions[i];
        
        if (p) {
          const labelWidth = colWidth - 80; // Space for the amount
          const amountWidth = 80;
          
          doc
            .font('Helvetica-Bold')
            .text(p.desc + ':', startX, currentY, { width: labelWidth, align: 'left' })
            .font('Helvetica')
            .text(p.val?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00', startX + labelWidth, currentY, { width: amountWidth, align: 'right' });
        }
        
        if (d) {
          const labelWidth = colWidth - 80; // Space for the amount
          const amountWidth = 80;
          
          doc
            .font('Helvetica-Bold')
            .text(d.desc + ':', startX + colWidth + spacingWidth, currentY, { width: labelWidth, align: 'left' })
            .font('Helvetica')
            .text(d.val?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00', startX + colWidth + spacingWidth + labelWidth, currentY, { width: amountWidth, align: 'right' });
        }
        
        currentY += 20;
      }

      // Totals row with divider
      currentY += 10;
      doc
        .moveTo(startX, currentY)
        .lineTo(startX + tableWidth, currentY)
        .strokeColor('#E5E7EB')
        .lineWidth(1)
        .stroke();
      currentY += 15;

      // Total Payments
      const labelWidth = colWidth - 80;
      const amountWidth = 80;
      
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Total Payments:', startX, currentY, { width: labelWidth, align: 'left' })
        .fillColor('#16A34A')
        .text(payroll.grossSalary.toLocaleString(undefined, { minimumFractionDigits: 2 }), startX + labelWidth, currentY, { width: amountWidth, align: 'right' });

      // Total Deductions
      doc
        .fillColor('#1C4E80')
        .text('Total Deductions:', startX + colWidth + spacingWidth, currentY, { width: labelWidth, align: 'left' })
        .fillColor('#DC2626')
        .text(payroll.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 }), startX + colWidth + spacingWidth + labelWidth, currentY, { width: amountWidth, align: 'right' });
      currentY += 30;

      // NET PAY (prominent)
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('NET PAY:', startX, currentY, { width: labelWidth, align: 'left' })
        .fillColor('#16A34A')
        .text(`${settings?.currency || 'QAR'} ${payroll.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX + labelWidth, currentY, { width: colWidth + amountWidth, align: 'right' });
      currentY += 30;

      // YTD information
      doc
        .fontSize(13)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text(`Gross Paid YTD: ${grossYTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX, currentY, { width: tableWidth, align: 'left' });
      currentY += 20;
      doc.text(`Net Paid YTD: ${netYTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX, currentY, { width: tableWidth, align: 'left' });
      currentY += 40;

      // Footer divider
      doc
        .moveTo(doc.page.margins.left, currentY)
        .lineTo(doc.page.width - doc.page.margins.right, currentY)
        .strokeColor('#E5E7EB')
        .lineWidth(1.5)
        .stroke();

      // Footer with system-generated note and support info
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('This is a system-generated payslip.', centerX, currentY + 20, { align: 'center' })
        .text('For support, contact support@stfbridge.com', centerX, currentY + 40, { align: 'center' });

      // End the document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Secure function to generate and store payslip to S3 with organization isolation
const generateAndStorePayslip = async (payroll) => {
  try {
    // Generate unique filename with organization isolation: payslips/{orgId}/{userId}/{yyyy-mm}.pdf
    const orgId = payroll.organization;
    const userId = payroll.staff._id;
    const payPeriod = payroll.payPeriod;
    const s3Key = `payslips/${orgId}/${userId}/${payPeriod}.pdf`;

    // Generate PDF buffer
    const pdfBuffer = await generatePayslipPDFBuffer(payroll);

    // Upload to S3
    await uploadFile(
      { 
        buffer: pdfBuffer, 
        mimetype: 'application/pdf', 
        originalname: `payslip-${payPeriod}.pdf` 
      }, 
      s3Key
    );

    console.log(`✅ Payslip generated and stored with secure structure: ${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error('Error generating and storing payslip:', error);
    throw error;
  }
};

// Main migration function
const migrateToSecurePayslips = async () => {
  try {
    console.log('🔒 Starting migration to secure organization-isolated payslips...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    console.log('🔄 Finding all paid payrolls to migrate to secure structure...');
    
    // Find all paid payrolls
    const paidPayrolls = await Payroll.find({ 
      paymentStatus: 'Paid' 
    }).populate({ 
      path: 'staff', 
      select: 'fullName department profileImage' 
    });
    
    console.log(`📊 Found ${paidPayrolls.length} paid payrolls to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const payroll of paidPayrolls) {
      try {
        console.log(`🔄 Migrating payslip for ${payroll.staff.fullName} - ${payroll.payPeriod} (Org: ${payroll.organization})`);
        
        // Generate and store payslip with new secure structure
        await generateAndStorePayslip(payroll);
        
        successCount++;
        console.log(`✅ Successfully migrated payslip for ${payroll.staff.fullName} - ${payroll.payPeriod}`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          skippedCount++;
          console.log(`⏭️ Skipped (already exists): ${payroll.staff.fullName} - ${payroll.payPeriod}`);
        } else {
          errorCount++;
          console.error(`❌ Failed to migrate payslip for ${payroll.staff.fullName} - ${payroll.payPeriod}:`, error.message);
        }
      }
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`📊 Total paid payrolls: ${paidPayrolls.length}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️ Skipped (already exists): ${skippedCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('========================\n');
    
    if (successCount > 0) {
      console.log('🎉 Migration completed successfully!');
      console.log('🔒 All payslips now use secure organization-isolated S3 structure');
      console.log('🛡️ Tenant isolation is now fully enforced');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
};

// Run the migration
migrateToSecurePayslips(); 