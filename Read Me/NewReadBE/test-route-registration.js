require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const enhancedPayrollRoutes = require('./src/routes/enhancedPayrollRoutes');

async function testRouteRegistration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // Create a test app
    const app = express();
    app.use(express.json());
    app.use('/api/enhanced-payroll', enhancedPayrollRoutes);

    // Test if the route is registered
    console.log('Testing route registration...');
    
    // Get all registered routes
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      } else if (middleware.name === 'router') {
        middleware.regexp && console.log('Router regexp:', middleware.regexp);
        middleware.handle.stack && middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            routes.push({
              path: middleware.regexp.source + handler.route.path,
              methods: Object.keys(handler.route.methods)
            });
          }
        });
      }
    });

    console.log('Registered routes:', routes);

    // Test a simple GET request to see if the route responds
    const response = await request(app)
      .get('/api/enhanced-payroll/wps-countries')
      .expect(401); // Should get 401 (unauthorized) not 404 (not found)

    console.log('✅ Route is registered (got 401 as expected for unauthorized request)');
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing route registration:', error);
    process.exit(1);
  }
}

testRouteRegistration();








