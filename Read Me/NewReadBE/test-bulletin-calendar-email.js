const { sendBulletinPostEmail, sendCalendarEventEmail } = require('./src/services/emailService');

// Mock data for testing
const mockOrganization = {
  _id: 'test-org-123',
  name: 'Test Organization',
  domain: 'testorg.com'
};

const mockAdmin = {
  _id: 'admin-123',
  fullName: 'John Admin',
  email: 'admin@testorg.com'
};

const mockUsers = [
  {
    _id: 'user-1',
    fullName: 'Jane Doe',
    email: 'jane@testorg.com'
  },
  {
    _id: 'user-2',
    fullName: 'Bob Smith',
    email: 'bob@testorg.com'
  }
];

const mockBulletinPost = {
  _id: 'post-123',
  title: 'Test Bulletin Post',
  body: '<p>Hello,</p><p>This is a test email sent for system verification purposes.</p><p>No action is required from your side.</p><p>Thank you,</p><p>Test User</p><p>Staff Bridge LLC</p>',
  images: [],
  createdAt: new Date()
};

const mockCalendarEvent = {
  _id: 'event-123',
  title: 'Test Calendar Event',
  description: '<p>This is a <strong>test calendar event</strong> for testing email notifications.</p><ul><li>Please bring your laptops</li><li>Meeting agenda will be shared</li><li>Light refreshments will be provided</li></ul><p><em>Looking forward to seeing everyone!</em></p>',
  date: '2024-01-15',
  time: '14:00',
  location: 'Conference Room A',
  createdAt: new Date()
};

async function testBulletinPostEmail() {
  console.log('Testing bulletin post email...');
  try {
    const result = await sendBulletinPostEmail({
      organization: mockOrganization,
      users: mockUsers,
      admin: mockAdmin,
      post: mockBulletinPost
    });
    console.log('✅ Bulletin post email test successful:', result);
  } catch (error) {
    console.error('❌ Bulletin post email test failed:', error.message);
  }
}

async function testCalendarEventEmail() {
  console.log('Testing calendar event email...');
  try {
    const result = await sendCalendarEventEmail({
      organization: mockOrganization,
      users: mockUsers,
      admin: mockAdmin,
      event: mockCalendarEvent
    });
    console.log('✅ Calendar event email test successful:', result);
  } catch (error) {
    console.error('❌ Calendar event email test failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting email notification tests...\n');
  
  await testBulletinPostEmail();
  console.log('');
  await testCalendarEventEmail();
  
  console.log('\n✨ Email notification tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testBulletinPostEmail,
  testCalendarEventEmail,
  runTests
}; 