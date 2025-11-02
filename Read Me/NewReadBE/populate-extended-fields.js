const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

// Mock data for different regions/countries
const mockData = {
  qatar: {
    cities: ['Doha', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Umm Salal'],
    addresses: [
      '123 Al Corniche Street, West Bay',
      '456 Pearl Boulevard, The Pearl',
      '789 Salwa Road, Al Wakrah',
      '321 Al Rayyan Road, Al Rayyan',
      '654 Al Khor Street, Al Khor'
    ],
    organizations: {
      address: 'Building 123, Al Corniche Street, West Bay',
      city: 'Doha',
      country: 'Qatar',
      phone: '+974 1234 5678',
      website: 'https://www.example.com',
      taxId: 'QAT-123456789',
      licenseNumber: 'LIC-QAT-2024-001',
      establishedDate: new Date('2010-01-15')
    }
  },
  uae: {
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah'],
    addresses: [
      '123 Sheikh Zayed Road, Dubai',
      '456 Corniche Road, Abu Dhabi',
      '789 King Faisal Street, Sharjah',
      '321 Al Rashid Road, Ajman',
      '654 Al Qawasim Street, Ras Al Khaimah'
    ],
    organizations: {
      address: 'Building 456, Sheikh Zayed Road, Downtown',
      city: 'Dubai',
      country: 'UAE',
      phone: '+971 4 123 4567',
      website: 'https://www.example.ae',
      taxId: 'UAE-987654321',
      licenseNumber: 'LIC-UAE-2024-002',
      establishedDate: new Date('2015-03-20')
    }
  },
  saudi: {
    cities: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam'],
    addresses: [
      '123 King Fahd Road, Riyadh',
      '456 Corniche Road, Jeddah',
      '789 Al Haram Street, Mecca',
      '321 Prophet Street, Medina',
      '654 King Khalid Road, Dammam'
    ],
    organizations: {
      address: 'Building 789, King Fahd Road, Olaya',
      city: 'Riyadh',
      country: 'Saudi Arabia',
      phone: '+966 11 123 4567',
      website: 'https://www.example.sa',
      taxId: 'SAU-456789123',
      licenseNumber: 'LIC-SAU-2024-003',
      establishedDate: new Date('2012-07-10')
    }
  }
};

// Employment types
const employmentTypes = ['Full-time', 'Part-time', 'Contract', 'Intern', 'Consultant'];

// Branch types
const branchTypes = ['Head Office', 'Regional Office', 'Branch Office', 'Sales Office', 'Service Center'];

// Passport number generators
const generatePassportNumber = (country) => {
  const prefixes = {
    'Qatar': 'QAT',
    'UAE': 'UAE', 
    'Saudi Arabia': 'SAU',
    'British': 'GBR',
    'Indian': 'IND',
    'Pakistani': 'PAK',
    'Filipino': 'PHL',
    'Egyptian': 'EGY'
  };
  const prefix = prefixes[country] || 'INT';
  const number = Math.floor(Math.random() * 900000000) + 100000000;
  return `${prefix}${number}`;
};

// Nationalities
const nationalities = ['Qatari', 'Emirati', 'Saudi', 'British', 'Indian', 'Pakistani', 'Filipino', 'Egyptian', 'Lebanese', 'Jordanian'];

async function populateExtendedFields() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('Connected to MongoDB');

    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations`);

    // Update organizations with mock data
    for (let i = 0; i < organizations.length; i++) {
      const org = organizations[i];
      const regionData = mockData.qatar; // Default to Qatar, could be randomized
      
      // Update organization with mock data
      await Organization.findByIdAndUpdate(org._id, {
        address: regionData.organizations.address,
        city: regionData.organizations.city,
        country: regionData.organizations.country,
        phone: regionData.organizations.phone,
        website: regionData.organizations.website,
        taxId: regionData.organizations.taxId,
        licenseNumber: regionData.organizations.licenseNumber,
        establishedDate: regionData.organizations.establishedDate
      });
      
      console.log(`Updated organization: ${org.name}`);
    }

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    // Update users with mock data
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const regionData = mockData.qatar; // Default to Qatar
      
      // Generate mock data for user
      const randomCity = regionData.cities[Math.floor(Math.random() * regionData.cities.length)];
      const randomAddress = regionData.addresses[Math.floor(Math.random() * regionData.addresses.length)];
      const randomNationality = nationalities[Math.floor(Math.random() * nationalities.length)];
      const randomEmploymentType = employmentTypes[Math.floor(Math.random() * employmentTypes.length)];
      const randomBranch = branchTypes[Math.floor(Math.random() * branchTypes.length)];
      
      // Update user with mock data
      await User.findByIdAndUpdate(user._id, {
        address: randomAddress,
        city: randomCity,
        country: 'Qatar',
        passportNumber: generatePassportNumber(randomNationality),
        employmentType: randomEmploymentType,
        branch: randomBranch
      });
      
      console.log(`Updated user: ${user.fullName} (${user.email})`);
    }

    console.log('✅ Successfully populated extended fields with mock data');
    console.log(`Updated ${organizations.length} organizations and ${users.length} users`);

  } catch (error) {
    console.error('❌ Error populating extended fields:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run the script
populateExtendedFields();









