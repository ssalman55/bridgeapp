const mongoose = require('mongoose');
const User = require('./src/models/User');
const StaffProfile = require('./src/models/StaffProfile');
const Organization = require('./src/models/Organization');

// Mock data generators
const mockData = {
  // Qatari names for realistic data
  firstNames: [
    'Ahmed', 'Mohammed', 'Ali', 'Hassan', 'Omar', 'Khalid', 'Saad', 'Fahad', 'Abdullah', 'Yousef',
    'Fatima', 'Aisha', 'Mariam', 'Khadija', 'Zainab', 'Amina', 'Huda', 'Nour', 'Layla', 'Sarah',
    'Salman', 'Ibrahim', 'Tariq', 'Nasser', 'Rashid', 'Majid', 'Hamad', 'Saeed', 'Waleed', 'Bader',
    'Noura', 'Reem', 'Dina', 'Hala', 'Rana', 'Mona', 'Lina', 'Rania', 'Dalia', 'Yasmin'
  ],
  
  lastNames: [
    'Al-Thani', 'Al-Mahmoud', 'Al-Kuwari', 'Al-Suwaidi', 'Al-Mansouri', 'Al-Hajri', 'Al-Marri',
    'Al-Sada', 'Al-Kaabi', 'Al-Rashid', 'Al-Zahra', 'Al-Mansoori', 'Al-Sheikh', 'Al-Malki',
    'Ahmad', 'Khan', 'Syed', 'Hassan', 'Ali', 'Mohammed', 'Ibrahim', 'Omar', 'Khalil',
    'Yousef', 'Saad', 'Fahad', 'Abdullah', 'Rashid', 'Tariq', 'Nasser', 'Majid', 'Hamad'
  ],

  departments: [
    'IT', 'HR', 'Finance', 'Operations', 'Marketing', 'Sales', 'Customer Service', 'Facilities',
    'Security', 'Maintenance', 'Sports', 'Academic', 'Administration', 'Legal', 'Procurement'
  ],

  roles: ['staff', 'admin', 'manager', 'supervisor', 'coordinator'],

  nationalities: [
    'Qatari', 'Pakistani', 'Indian', 'Bangladeshi', 'Filipino', 'Nepali', 'Sri Lankan',
    'Egyptian', 'Jordanian', 'Lebanese', 'Syrian', 'Sudanese', 'Moroccan', 'Tunisian',
    'British', 'American', 'Canadian', 'Australian', 'South African', 'Kenyan'
  ],

  maritalStatuses: ['Single', 'Married', 'Divorced', 'Widowed'],

  genders: ['Male', 'Female'],

  banks: [
    'Qatar National Bank', 'Commercial Bank of Qatar', 'Doha Bank', 'Qatar Islamic Bank',
    'Masraf Al Rayan', 'Al Khaliji Commercial Bank', 'HSBC Qatar', 'Standard Chartered Qatar',
    'Barclays Qatar', 'Arab Bank Qatar'
  ],

  certifications: [
    'PMP Certification', 'ITIL Foundation', 'Microsoft Certified Professional', 'Cisco CCNA',
    'AWS Certified Solutions Architect', 'Google Analytics Certified', 'Salesforce Administrator',
    'CompTIA Security+', 'Certified Public Accountant', 'Human Resources Professional',
    'Project Management Professional', 'Six Sigma Green Belt', 'Lean Management',
    'ISO 9001 Lead Auditor', 'Agile Scrum Master'
  ],

  professionalMemberships: [
    'Qatar Society of Engineers', 'Qatar Medical Association', 'Qatar Chamber of Commerce',
    'Project Management Institute', 'Institute of Electrical and Electronics Engineers',
    'Association for Computing Machinery', 'Society for Human Resource Management',
    'American Management Association', 'International Association of Business Communicators'
  ],

  insuranceProviders: [
    'Qatar Insurance Company', 'Doha Insurance Group', 'Al Khaleej Takaful Insurance',
    'Qatar General Insurance', 'Doha Takaful', 'Qatar Islamic Insurance Company',
    'Gulf Insurance Group', 'Arab Insurance Group'
  ],

  allergies: [
    'None', 'Peanuts', 'Shellfish', 'Dairy', 'Gluten', 'Pollen', 'Dust', 'Medication',
    'Latex', 'Bee Stings', 'Soy', 'Eggs', 'Fish', 'Tree Nuts'
  ],

  preExistingConditions: [
    'None', 'Diabetes', 'Hypertension', 'Asthma', 'Arthritis', 'Heart Condition',
    'Thyroid Disorder', 'Migraine', 'Depression', 'Anxiety', 'Back Problems'
  ],

  degrees: [
    'Bachelor of Engineering', 'Bachelor of Science', 'Bachelor of Arts', 'Bachelor of Business Administration',
    'Master of Science', 'Master of Business Administration', 'Master of Engineering', 'Master of Arts',
    'Doctor of Philosophy', 'Associate Degree', 'Diploma', 'Certificate'
  ],

  institutes: [
    'Qatar University', 'Hamad Bin Khalifa University', 'Texas A&M University Qatar',
    'Carnegie Mellon University Qatar', 'Georgetown University Qatar', 'Northwestern University Qatar',
    'Virginia Commonwealth University Qatar', 'University of Calgary Qatar',
    'University of London', 'American University', 'British University', 'Canadian University'
  ],

  countries: [
    'Qatar', 'Pakistan', 'India', 'Bangladesh', 'Philippines', 'Nepal', 'Sri Lanka',
    'Egypt', 'Jordan', 'Lebanon', 'Syria', 'Sudan', 'Morocco', 'Tunisia',
    'United Kingdom', 'United States', 'Canada', 'Australia', 'South Africa', 'Kenya'
  ],

  schools: [
    'Qatar Academy', 'American School of Doha', 'Doha College', 'The British School',
    'International School of London', 'Canadian International School', 'German School',
    'French School', 'Indian School', 'Pakistani School', 'Philippine School',
    'Sri Lankan School', 'Nepalese School', 'Bangladeshi School'
  ]
};

// Generate random IBAN (Qatar format: QA + 2 check digits + 4 bank code + 4 branch + 16 account)
function generateQatarIBAN() {
  const bankCodes = ['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009', '0010'];
  const branchCodes = ['0001', '0002', '0003', '0004', '0005'];
  
  const bankCode = bankCodes[Math.floor(Math.random() * bankCodes.length)];
  const branchCode = branchCodes[Math.floor(Math.random() * branchCodes.length)];
  const accountNumber = Math.floor(Math.random() * 10000000000000000).toString().padStart(16, '0');
  
  // Generate check digits (simplified - in real implementation, you'd use proper IBAN validation)
  const checkDigits = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  
  return `QA${checkDigits}${bankCode}${branchCode}${accountNumber}`;
}

// Generate random phone number (Qatar format)
function generateQatarPhone() {
  const prefixes = ['3000', '3001', '3002', '3003', '3004', '3005', '3006', '3007', '3008', '3009',
                   '3010', '3011', '3012', '3013', '3014', '3015', '3016', '3017', '3018', '3019',
                   '3020', '3021', '3022', '3023', '3024', '3025', '3026', '3027', '3028', '3029',
                   '3030', '3031', '3032', '3033', '3034', '3035', '3036', '3037', '3038', '3039',
                   '3040', '3041', '3042', '3043', '3044', '3045', '3046', '3047', '3048', '3049',
                   '3050', '3051', '3052', '3053', '3054', '3055', '3056', '3057', '3058', '3059',
                   '3060', '3061', '3062', '3063', '3064', '3065', '3066', '3067', '3068', '3069',
                   '3070', '3071', '3072', '3073', '3074', '3075', '3076', '3077', '3078', '3079',
                   '3080', '3081', '3082', '3083', '3084', '3085', '3086', '3087', '3088', '3089',
                   '3090', '3091', '3092', '3093', '3094', '3095', '3096', '3097', '3098', '3099',
                   '5000', '5001', '5002', '5003', '5004', '5005', '5006', '5007', '5008', '5009',
                   '5010', '5011', '5012', '5013', '5014', '5015', '5016', '5017', '5018', '5019',
                   '5020', '5021', '5022', '5023', '5024', '5025', '5026', '5027', '5028', '5029',
                   '5030', '5031', '5032', '5033', '5034', '5035', '5036', '5037', '5038', '5039',
                   '5040', '5041', '5042', '5043', '5044', '5045', '5046', '5047', '5048', '5049',
                   '5050', '5051', '5052', '5053', '5054', '5055', '5056', '5057', '5058', '5059',
                   '5060', '5061', '5062', '5063', '5064', '5065', '5066', '5067', '5068', '5069',
                   '5070', '5071', '5072', '5073', '5074', '5075', '5076', '5077', '5078', '5079',
                   '5080', '5081', '5082', '5083', '5084', '5085', '5086', '5087', '5088', '5089',
                   '5090', '5091', '5092', '5093', '5094', '5095', '5096', '5097', '5098', '5099',
                   '6000', '6001', '6002', '6003', '6004', '6005', '6006', '6007', '6008', '6009',
                   '6010', '6011', '6012', '6013', '6014', '6015', '6016', '6017', '6018', '6019',
                   '6020', '6021', '6022', '6023', '6024', '6025', '6026', '6027', '6028', '6029',
                   '6030', '6031', '6032', '6033', '6034', '6035', '6036', '6037', '6038', '6039',
                   '6040', '6041', '6042', '6043', '6044', '6045', '6046', '6047', '6048', '6049',
                   '6050', '6051', '6052', '6053', '6054', '6055', '6056', '6057', '6058', '6059',
                   '6060', '6061', '6062', '6063', '6064', '6065', '6066', '6067', '6068', '6069',
                   '6070', '6071', '6072', '6073', '6074', '6075', '6076', '6077', '6078', '6079',
                   '6080', '6081', '6082', '6083', '6084', '6085', '6086', '6087', '6088', '6089',
                   '6090', '6091', '6092', '6093', '6094', '6095', '6096', '6097', '6098', '6099',
                   '7000', '7001', '7002', '7003', '7004', '7005', '7006', '7007', '7008', '7009',
                   '7010', '7011', '7012', '7013', '7014', '7015', '7016', '7017', '7018', '7019',
                   '7020', '7021', '7022', '7023', '7024', '7025', '7026', '7027', '7028', '7029',
                   '7030', '7031', '7032', '7033', '7034', '7035', '7036', '7037', '7038', '7039',
                   '7040', '7041', '7042', '7043', '7044', '7045', '7046', '7047', '7048', '7049',
                   '7050', '7051', '7052', '7053', '7054', '7055', '7056', '7057', '7058', '7059',
                   '7060', '7061', '7062', '7063', '7064', '7065', '7066', '7067', '7068', '7069',
                   '7070', '7071', '7072', '7073', '7074', '7075', '7076', '7077', '7078', '7079',
                   '7080', '7081', '7082', '7083', '7084', '7085', '7086', '7087', '7088', '7089',
                   '7090', '7091', '7092', '7093', '7094', '7095', '7096', '7097', '7098', '7099'];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `+974${prefix}${suffix}`;
}

// Generate random date of birth (between 18 and 65 years ago)
function generateDOB() {
  const now = new Date();
  const minAge = 18;
  const maxAge = 65;
  const minDate = new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate());
  const maxDate = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
  
  return new Date(minDate.getTime() + Math.random() * (maxDate.getTime() - minDate.getTime()));
}

// Generate random work experience
function generateWorkExperience() {
  const companies = [
    'Qatar Petroleum', 'Qatar Airways', 'Qatar National Bank', 'Commercial Bank of Qatar',
    'Doha Bank', 'Qatar Islamic Bank', 'Qatar Foundation', 'Hamad Medical Corporation',
    'Qatar University', 'Texas A&M University Qatar', 'Carnegie Mellon University Qatar',
    'Microsoft Qatar', 'Google Qatar', 'Amazon Qatar', 'IBM Qatar', 'Oracle Qatar',
    'SAP Qatar', 'Accenture Qatar', 'Deloitte Qatar', 'PwC Qatar', 'KPMG Qatar',
    'Ernst & Young Qatar', 'McKinsey Qatar', 'Boston Consulting Group Qatar',
    'Bain & Company Qatar', 'Qatar Investment Authority', 'Qatar Development Bank',
    'Qatar Financial Centre', 'Qatar Stock Exchange', 'Qatar Central Bank'
  ];

  const designations = [
    'Software Engineer', 'Senior Software Engineer', 'Lead Developer', 'Technical Lead',
    'Project Manager', 'Senior Project Manager', 'Program Manager', 'Product Manager',
    'Business Analyst', 'Senior Business Analyst', 'Data Analyst', 'Data Scientist',
    'HR Manager', 'HR Business Partner', 'Recruitment Specialist', 'Training Manager',
    'Finance Manager', 'Financial Analyst', 'Accountant', 'Senior Accountant',
    'Operations Manager', 'Operations Coordinator', 'Supply Chain Manager',
    'Marketing Manager', 'Digital Marketing Specialist', 'Content Manager',
    'Sales Manager', 'Sales Executive', 'Customer Success Manager',
    'IT Manager', 'System Administrator', 'Network Engineer', 'Database Administrator',
    'Security Analyst', 'Compliance Officer', 'Legal Counsel', 'Legal Advisor'
  ];

  const experiences = [];
  const numExperiences = Math.floor(Math.random() * 4) + 1; // 1-4 experiences

  for (let i = 0; i < numExperiences; i++) {
    const startDate = new Date(2020 - Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), 1);
    const endDate = i === 0 ? null : new Date(startDate.getTime() + Math.random() * (365 * 2 * 24 * 60 * 60 * 1000));
    
    experiences.push({
      companyName: companies[Math.floor(Math.random() * companies.length)],
      designation: designations[Math.floor(Math.random() * designations.length)],
      from: startDate,
      to: endDate,
      responsibilities: `Led cross-functional teams and managed key projects. Implemented best practices and delivered measurable results. Collaborated with stakeholders to ensure project success and client satisfaction.`
    });
  }

  return experiences;
}

// Generate random education
function generateEducation() {
  const educations = [];
  const numEducations = Math.floor(Math.random() * 3) + 1; // 1-3 education records

  for (let i = 0; i < numEducations; i++) {
    const year = 2020 - Math.floor(Math.random() * 20); // Last 20 years
    
    educations.push({
      degree: mockData.degrees[Math.floor(Math.random() * mockData.degrees.length)],
      institute: mockData.institutes[Math.floor(Math.random() * mockData.institutes.length)],
      year: year,
      country: mockData.countries[Math.floor(Math.random() * mockData.countries.length)],
      documentUrl: null // No document URLs for mock data
    });
  }

  return educations;
}

// Generate random children
function generateChildren() {
  const children = [];
  const numChildren = Math.floor(Math.random() * 4); // 0-3 children

  for (let i = 0; i < numChildren; i++) {
    const dob = new Date(2020 - Math.floor(Math.random() * 18), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    
    children.push({
      name: `${mockData.firstNames[Math.floor(Math.random() * mockData.firstNames.length)]} ${mockData.lastNames[Math.floor(Math.random() * mockData.lastNames.length)]}`,
      dob: dob,
      school: mockData.schools[Math.floor(Math.random() * mockData.schools.length)]
    });
  }

  return children;
}

// Generate random certifications
function generateCertifications() {
  const certifications = [];
  const numCerts = Math.floor(Math.random() * 5); // 0-4 certifications

  for (let i = 0; i < numCerts; i++) {
    certifications.push(mockData.certifications[Math.floor(Math.random() * mockData.certifications.length)]);
  }

  return [...new Set(certifications)]; // Remove duplicates
}

// Generate random professional memberships
function generateProfessionalMemberships() {
  const memberships = [];
  const numMemberships = Math.floor(Math.random() * 3); // 0-2 memberships

  for (let i = 0; i < numMemberships; i++) {
    memberships.push(mockData.professionalMemberships[Math.floor(Math.random() * mockData.professionalMemberships.length)]);
  }

  return [...new Set(memberships)]; // Remove duplicates
}

// Generate mock staff profile data
function generateMockStaffProfile(staffId, organizationId) {
  const firstName = mockData.firstNames[Math.floor(Math.random() * mockData.firstNames.length)];
  const lastName = mockData.lastNames[Math.floor(Math.random() * mockData.lastNames.length)];
  const gender = mockData.genders[Math.floor(Math.random() * mockData.genders.length)];
  const nationality = mockData.nationalities[Math.floor(Math.random() * mockData.nationalities.length)];
  const maritalStatus = mockData.maritalStatuses[Math.floor(Math.random() * mockData.maritalStatuses.length)];
  
  // Calculate completion percentage based on filled fields
  const completionPercentage = Math.floor(Math.random() * 100);

  return {
    staffId: staffId,
    organization: organizationId,
    personalInfo: {
      dob: generateDOB(),
      gender: gender,
      nationality: nationality,
      maritalStatus: maritalStatus,
      emergencyContact: {
        name: `${mockData.firstNames[Math.floor(Math.random() * mockData.firstNames.length)]} ${mockData.lastNames[Math.floor(Math.random() * mockData.lastNames.length)]}`,
        phone: generateQatarPhone(),
        relationship: ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Relative'][Math.floor(Math.random() * 6)]
      }
    },
    workExperience: generateWorkExperience(),
    education: generateEducation(),
    medicalHistory: {
      preExistingConditions: mockData.preExistingConditions[Math.floor(Math.random() * mockData.preExistingConditions.length)],
      allergies: mockData.allergies[Math.floor(Math.random() * mockData.allergies.length)],
      insuranceProvider: mockData.insuranceProviders[Math.floor(Math.random() * mockData.insuranceProviders.length)]
    },
    children: generateChildren(),
    additionalInfo: {
      bankAccount: generateQatarIBAN(),
      certifications: generateCertifications(),
      professionalMemberships: generateProfessionalMemberships()
    },
    isComplete: completionPercentage >= 80,
    completionPercentage: completionPercentage
  };
}

// Main seeding function
async function seedStaffProfiles() {
  try {
    console.log('🌱 Starting staff profile seeding...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get all organizations
    const organizations = await Organization.find({});
    if (organizations.length === 0) {
      console.log('❌ No organizations found. Please create an organization first.');
      process.exit(1);
    }

    console.log(`📊 Found ${organizations.length} organization(s)`);

    let totalProfilesCreated = 0;
    let totalProfilesUpdated = 0;

    // Process each organization
    for (const org of organizations) {
      console.log(`\n🏢 Processing organization: ${org.name} (${org._id})`);
      
      // Get all staff members for this organization
      const staffMembers = await User.find({ 
        organization: org._id,
        status: { $ne: 'archived' }
      }).select('_id fullName email department role');

      console.log(`👥 Found ${staffMembers.length} staff members`);

      if (staffMembers.length === 0) {
        console.log('⚠️  No staff members found for this organization, skipping...');
        continue;
      }

      // Process each staff member
      for (const staff of staffMembers) {
        try {
          // Check if profile already exists
          const existingProfile = await StaffProfile.findOne({ staffId: staff._id });
          
          if (existingProfile) {
            console.log(`📝 Updating existing profile for ${staff.fullName}...`);
            
            // Update existing profile with new mock data
            const updatedData = generateMockStaffProfile(staff._id, org._id);
            await StaffProfile.findByIdAndUpdate(existingProfile._id, updatedData, { new: true });
            totalProfilesUpdated++;
          } else {
            console.log(`🆕 Creating new profile for ${staff.fullName}...`);
            
            // Create new profile
            const profileData = generateMockStaffProfile(staff._id, org._id);
            const newProfile = new StaffProfile(profileData);
            await newProfile.save();
            totalProfilesCreated++;
          }
        } catch (error) {
          console.error(`❌ Error processing ${staff.fullName}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Seeding completed!');
    console.log(`📊 Summary:`);
    console.log(`   • Profiles created: ${totalProfilesCreated}`);
    console.log(`   • Profiles updated: ${totalProfilesUpdated}`);
    console.log(`   • Total processed: ${totalProfilesCreated + totalProfilesUpdated}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeding script
if (require.main === module) {
  seedStaffProfiles();
}

module.exports = { seedStaffProfiles };




