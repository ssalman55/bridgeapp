const axios = require('axios');

const createAdmin = async () => {
  try {
    console.log('Attempting to create admin user...');
    const response = await axios.post('http://127.0.0.1:5000/api/auth/register', {
      fullName: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      department: 'Administration',
      position: 'Admin',
      role: 'admin'
    });
    console.log('Admin user created successfully:', response.data);
  } catch (error) {
    console.error('Error creating admin user:');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received');
      console.error('Request:', error.request);
    } else {
      console.error('Error:', error.message);
    }
  }
};

createAdmin(); 