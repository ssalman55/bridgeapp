const mongoose = require('mongoose');
const Payroll = require('../src/models/Payroll');
const payrollController = require('../src/controllers/payrollController');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const generateExistingPayslips = async () => {
  try {
    console.log('Starting payslip generation for existing paid payrolls...');
    
    // Find all paid payrolls
    const paidPayrolls = await Payroll.find({ 
      paymentStatus: 'Paid' 
    }).populate({ 
      path: 'staff', 
      select: 'fullName department profileImage' 
    });
    
    console.log(`Found ${paidPayrolls.length} paid payrolls to process`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const payroll of paidPayrolls) {
      try {
        console.log(`Processing payslip for ${payroll.staff.fullName} - ${payroll.payPeriod}`);
        
        // Generate and store payslip using the controller function
        await payrollController.generateAndStorePayslip(payroll);
        
        successCount++;
        console.log(`✅ Successfully generated payslip for ${payroll.staff.fullName} - ${payroll.payPeriod}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to generate payslip for ${payroll.staff.fullName} - ${payroll.payPeriod}:`, error.message);
      }
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`Total paid payrolls: ${paidPayrolls.length}`);
    console.log(`Successfully generated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log('========================\n');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the migration
generateExistingPayslips(); 