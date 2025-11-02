require('dotenv').config();
const mongoose = require('mongoose');
const InventoryItemName = require('./src/models/InventoryItemName');
const InventoryItem = require('./src/models/InventoryItem');
const InventoryRequest = require('./src/models/InventoryRequest');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

// Mock data for inventory items
const inventoryCategories = [
  'IT Equipment',
  'Office Supplies',
  'Furniture',
  'Electronics',
  'Safety Equipment',
  'Maintenance Tools',
  'Stationery',
  'Cleaning Supplies'
];

const itEquipmentItems = [
  { name: 'Dell Laptop - Inspiron 15', category: 'IT Equipment', basePrice: 2500, description: 'High-performance laptop for office work' },
  { name: 'HP Desktop Computer', category: 'IT Equipment', basePrice: 1800, description: 'Desktop computer for administrative tasks' },
  { name: 'MacBook Pro 13-inch', category: 'IT Equipment', basePrice: 3500, description: 'Professional laptop for creative work' },
  { name: 'Dell Monitor 24-inch', category: 'IT Equipment', basePrice: 300, description: 'Full HD monitor for enhanced productivity' },
  { name: 'Wireless Mouse - Logitech', category: 'IT Equipment', basePrice: 45, description: 'Ergonomic wireless mouse' },
  { name: 'Mechanical Keyboard', category: 'IT Equipment', basePrice: 120, description: 'RGB mechanical keyboard' },
  { name: 'Webcam HD 1080p', category: 'IT Equipment', basePrice: 80, description: 'High-definition webcam for video calls' },
  { name: 'USB-C Hub', category: 'IT Equipment', basePrice: 65, description: 'Multi-port USB-C hub' },
  { name: 'External Hard Drive 1TB', category: 'IT Equipment', basePrice: 90, description: 'Portable storage device' },
  { name: 'Network Switch 24-port', category: 'IT Equipment', basePrice: 200, description: 'Gigabit network switch' }
];

const officeSuppliesItems = [
  { name: 'Office Chair - Ergonomic', category: 'Office Supplies', basePrice: 350, description: 'Adjustable ergonomic office chair' },
  { name: 'Desk Lamp LED', category: 'Office Supplies', basePrice: 75, description: 'Energy-efficient LED desk lamp' },
  { name: 'File Cabinet 4-drawer', category: 'Office Supplies', basePrice: 180, description: 'Metal file cabinet for document storage' },
  { name: 'Whiteboard 4x6 feet', category: 'Office Supplies', basePrice: 120, description: 'Magnetic whiteboard for presentations' },
  { name: 'Printer Paper A4', category: 'Office Supplies', basePrice: 25, description: 'High-quality printer paper (500 sheets)' },
  { name: 'Stapler Heavy Duty', category: 'Office Supplies', basePrice: 35, description: 'Heavy-duty stapler for office use' },
  { name: 'Paper Shredder', category: 'Office Supplies', basePrice: 150, description: 'Cross-cut paper shredder' },
  { name: 'Desk Organizer Set', category: 'Office Supplies', basePrice: 45, description: 'Multi-compartment desk organizer' }
];

const furnitureItems = [
  { name: 'Conference Table 8-seater', category: 'Furniture', basePrice: 800, description: 'Large conference table for meetings' },
  { name: 'Office Desk Executive', category: 'Furniture', basePrice: 450, description: 'Executive office desk with drawers' },
  { name: 'Bookshelf 5-tier', category: 'Furniture', basePrice: 200, description: 'Wooden bookshelf for office storage' },
  { name: 'Reception Sofa Set', category: 'Furniture', basePrice: 600, description: 'Comfortable sofa set for reception area' },
  { name: 'Meeting Room Chairs', category: 'Furniture', basePrice: 120, description: 'Comfortable chairs for meeting rooms' }
];

const electronicsItems = [
  { name: 'Projector HD 1080p', category: 'Electronics', basePrice: 500, description: 'High-definition projector for presentations' },
  { name: 'Sound System Bluetooth', category: 'Electronics', basePrice: 200, description: 'Wireless Bluetooth sound system' },
  { name: 'Digital Camera', category: 'Electronics', basePrice: 400, description: 'Professional digital camera' },
  { name: 'Tablet iPad', category: 'Electronics', basePrice: 600, description: 'Apple iPad for presentations' },
  { name: 'Smart TV 55-inch', category: 'Electronics', basePrice: 800, description: 'Smart TV for conference rooms' }
];

const safetyEquipmentItems = [
  { name: 'Fire Extinguisher', category: 'Safety Equipment', basePrice: 80, description: 'Dry chemical fire extinguisher' },
  { name: 'First Aid Kit', category: 'Safety Equipment', basePrice: 60, description: 'Complete first aid medical kit' },
  { name: 'Safety Helmet', category: 'Safety Equipment', basePrice: 25, description: 'Hard hat for construction work' },
  { name: 'Safety Vest Reflective', category: 'Safety Equipment', basePrice: 15, description: 'High-visibility safety vest' },
  { name: 'Emergency Exit Sign', category: 'Safety Equipment', basePrice: 40, description: 'LED emergency exit sign' }
];

const maintenanceToolsItems = [
  { name: 'Toolbox Complete Set', category: 'Maintenance Tools', basePrice: 150, description: 'Complete set of maintenance tools' },
  { name: 'Drill Machine Cordless', category: 'Maintenance Tools', basePrice: 120, description: 'Cordless drill machine' },
  { name: 'Ladder Extension 12ft', category: 'Maintenance Tools', basePrice: 100, description: 'Aluminum extension ladder' },
  { name: 'Multimeter Digital', category: 'Maintenance Tools', basePrice: 80, description: 'Digital multimeter for electrical work' },
  { name: 'Screwdriver Set', category: 'Maintenance Tools', basePrice: 35, description: 'Professional screwdriver set' }
];

const stationeryItems = [
  { name: 'Ballpoint Pen Set', category: 'Stationery', basePrice: 15, description: 'Set of 12 ballpoint pens' },
  { name: 'Notebook A4 Spiral', category: 'Stationery', basePrice: 8, description: 'Spiral-bound notebook' },
  { name: 'Highlighter Set', category: 'Stationery', basePrice: 12, description: 'Set of 6 highlighters' },
  { name: 'Calculator Scientific', category: 'Stationery', basePrice: 25, description: 'Scientific calculator' },
  { name: 'Sticky Notes Pack', category: 'Stationery', basePrice: 6, description: 'Pack of 10 sticky note pads' }
];

const cleaningSuppliesItems = [
  { name: 'Vacuum Cleaner', category: 'Cleaning Supplies', basePrice: 200, description: 'Commercial vacuum cleaner' },
  { name: 'Cleaning Chemicals Set', category: 'Cleaning Supplies', basePrice: 50, description: 'Set of cleaning chemicals' },
  { name: 'Mop and Bucket Set', category: 'Cleaning Supplies', basePrice: 30, description: 'Complete mopping set' },
  { name: 'Trash Can 50L', category: 'Cleaning Supplies', basePrice: 25, description: 'Large capacity trash can' },
  { name: 'Air Freshener Dispenser', category: 'Cleaning Supplies', basePrice: 20, description: 'Automatic air freshener' }
];

// Combine all items
const allInventoryItems = [
  ...itEquipmentItems,
  ...officeSuppliesItems,
  ...furnitureItems,
  ...electronicsItems,
  ...safetyEquipmentItems,
  ...maintenanceToolsItems,
  ...stationeryItems,
  ...cleaningSuppliesItems
];

// Generate unique item codes and serial numbers
function generateItemCode(category, index, orgId) {
  const categoryPrefix = {
    'IT Equipment': 'IT',
    'Office Supplies': 'OS',
    'Furniture': 'FR',
    'Electronics': 'EL',
    'Safety Equipment': 'SE',
    'Maintenance Tools': 'MT',
    'Stationery': 'ST',
    'Cleaning Supplies': 'CS'
  };
  // Use first 4 characters of orgId to make it unique per organization
  const orgPrefix = orgId.toString().substring(0, 4).toUpperCase();
  return `${orgPrefix}-${categoryPrefix[category]}-${String(index + 1).padStart(3, '0')}`;
}

function generateSerialNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function seedInventoryData() {
  try {
    console.log('🚀 Starting Inventory Seeding Script...');
    console.log('📋 This will create comprehensive mock data for Assets/Inventory module');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('✅ Connected to MongoDB');

    // Get organizations and staff
    const organizations = await Organization.find({}, 'name _id');
    const staff = await User.find({ role: 'staff', status: 'active' }, 'fullName email department organization');

    console.log(`📊 Found ${organizations.length} organization(s) and ${staff.length} staff members`);

    let totalItemNames = 0;
    let totalItems = 0;
    let totalRequests = 0;

    for (const org of organizations) {
      console.log(`\n🏢 Processing organization: ${org.name} (${org._id})`);
      
      const orgStaff = staff.filter(s => s.organization.toString() === org._id.toString());
      console.log(`👥 Found ${orgStaff.length} staff members in this organization`);

      // 1. Create Inventory Item Names
      console.log('📝 Creating inventory item names...');
      const itemNames = [];
      
      for (const item of allInventoryItems) {
        try {
          const itemName = new InventoryItemName({
            name: item.name,
            organization: org._id,
            category: item.category
          });
          await itemName.save();
          itemNames.push(itemName);
          totalItemNames++;
        } catch (error) {
          if (error.code === 11000) {
            // Item name already exists, find it
            const existing = await InventoryItemName.findOne({
              name: item.name,
              organization: org._id
            });
            if (existing) itemNames.push(existing);
          } else {
            console.error(`Error creating item name ${item.name}:`, error.message);
          }
        }
      }

      // 2. Create Inventory Items with various statuses
      console.log('📦 Creating inventory items...');
      const inventoryItems = [];
      
      for (let i = 0; i < itemNames.length; i++) {
        const itemName = itemNames[i];
        const baseItem = allInventoryItems.find(item => item.name === itemName.name);
        
        // Create multiple instances of each item (1-5 instances)
        const instances = Math.floor(Math.random() * 5) + 1;
        
        for (let j = 0; j < instances; j++) {
          const itemCode = generateItemCode(itemName.category, i, org._id);
          const serialNumber = generateSerialNumber();
          
          // Determine status and assignment
          let status = 'In Stock';
          let assignedTo = null;
          let assignedDate = null;
          
          // 30% chance of being assigned to staff (only if staff exists)
          if (Math.random() < 0.3 && orgStaff.length > 0) {
            status = 'assigned';
            assignedTo = orgStaff[Math.floor(Math.random() * orgStaff.length)]._id;
            assignedDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000); // Random date within last 90 days
          }
          
          // Random quantity (1-10 for most items, 1-50 for stationery/cleaning supplies)
          const maxQuantity = ['Stationery', 'Cleaning Supplies'].includes(itemName.category) ? 50 : 10;
          const quantity = Math.floor(Math.random() * maxQuantity) + 1;
          
          // Random unit cost with some variation
          const costVariation = 0.8 + Math.random() * 0.4; // ±20% variation
          const unitCost = Math.round(baseItem.basePrice * costVariation);
          
          const inventoryItem = new InventoryItem({
            itemCode: `${itemCode}-${String(j + 1).padStart(2, '0')}`,
            serialNumber: serialNumber,
            name: itemName.name,
            category: itemName.category,
            description: baseItem.description,
            quantity: quantity,
            minimumThreshold: Math.max(1, Math.floor(quantity * 0.2)), // 20% of quantity
            unitCost: unitCost,
            status: status,
            organization: org._id,
            assignedTo: assignedTo,
            assignedDate: assignedDate
          });

          await inventoryItem.save();
          inventoryItems.push(inventoryItem);
          totalItems++;
        }
      }

      // 3. Create Inventory Requests with different statuses
      console.log('📋 Creating inventory requests...');
      
      // Create requests for some items that don't exist yet or are low stock
      const requestItems = [
        { name: 'Gaming Chair Ergonomic', category: 'Office Supplies', justification: 'Need for new employee workstation setup' },
        { name: 'Standing Desk Adjustable', category: 'Furniture', justification: 'Request for ergonomic workspace improvement' },
        { name: 'Noise-Canceling Headphones', category: 'IT Equipment', justification: 'Required for remote work and video calls' },
        { name: 'Document Scanner', category: 'IT Equipment', justification: 'Need for digitizing paper documents' },
        { name: 'Coffee Machine Office', category: 'Office Supplies', justification: 'Request for staff break room amenities' },
        { name: 'Whiteboard Markers Set', category: 'Stationery', justification: 'Replacement for depleted office supplies' },
        { name: 'Air Purifier', category: 'Electronics', justification: 'Improve air quality in office environment' },
        { name: 'Security Camera System', category: 'Safety Equipment', justification: 'Enhance office security measures' }
      ];

      for (let i = 0; i < requestItems.length; i++) {
        const requestItem = requestItems[i];
        
        // Skip creating requests if no staff in organization
        if (orgStaff.length === 0) {
          console.log(`   ⚠️  Skipping requests for ${org.name} - no staff members`);
          break;
        }
        
        const requester = orgStaff[Math.floor(Math.random() * orgStaff.length)];
        
        // Determine status: 40% pending, 35% approved, 25% rejected
        const statusRand = Math.random();
        let status, decisionDate, decisionBy;
        
        if (statusRand < 0.4) {
          status = 'Pending';
        } else if (statusRand < 0.75) {
          status = 'Approved';
          decisionDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Within last 30 days
          decisionBy = orgStaff[Math.floor(Math.random() * orgStaff.length)]._id;
        } else {
          status = 'Rejected';
          decisionDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Within last 30 days
          decisionBy = orgStaff[Math.floor(Math.random() * orgStaff.length)]._id;
        }

        const inventoryRequest = new InventoryRequest({
          staff: requester._id,
          itemName: requestItem.name,
          category: requestItem.category,
          quantity: Math.floor(Math.random() * 5) + 1, // 1-5 quantity
          justification: requestItem.justification,
          requiredDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000), // Within next 30 days
          status: status,
          decisionDate: decisionDate,
          decisionBy: decisionBy,
          organization: org._id
        });

        await inventoryRequest.save();
        totalRequests++;
      }

      console.log(`✅ Completed ${org.name}:`);
      console.log(`   • Item names: ${itemNames.length}`);
      console.log(`   • Inventory items: ${inventoryItems.length}`);
      console.log(`   • Requests: ${requestItems.length}`);
    }

    console.log('\n🎉 Inventory seeding completed!');
    console.log('📊 Summary:');
    console.log(`   • Item names created: ${totalItemNames}`);
    console.log(`   • Inventory items created: ${totalItems}`);
    console.log(`   • Inventory requests created: ${totalRequests}`);
    console.log(`   • Total records: ${totalItemNames + totalItems + totalRequests}`);

    // Show sample data
    console.log('\n📋 Sample of created data:');
    const sampleItems = await InventoryItem.find({}).populate('assignedTo', 'fullName').limit(5);
    console.log('Sample inventory items:');
    sampleItems.forEach(item => {
      console.log(`   • ${item.name} (${item.itemCode}) - Status: ${item.status}${item.assignedTo ? ` - Assigned to: ${item.assignedTo.fullName}` : ''}`);
    });

    const sampleRequests = await InventoryRequest.find({}).populate('staff', 'fullName').populate('decisionBy', 'fullName').limit(5);
    console.log('\nSample inventory requests:');
    sampleRequests.forEach(req => {
      console.log(`   • ${req.itemName} - Status: ${req.status} - Requested by: ${req.staff.fullName}`);
    });

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedInventoryData();
