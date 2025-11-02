const axios = require('axios');

// Clear dashboard cache and test
async function clearCacheAndTest() {
  try {
    console.log('🧹 Clearing dashboard cache...');
    
    // Clear cache
    const clearResponse = await axios.post('http://localhost:5000/api/head-office/clear-cache', {}, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE', // You'll need to replace this with a real token
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Cache cleared:', clearResponse.data.message);
    
    console.log('\n🔄 Now refresh your Head Office Command Center dashboard (Ctrl+F5)');
    console.log('📊 The Total Payroll and Network Revenue should now show correct values!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Manual cache clearing:');
    console.log('1. Restart the backend server (Ctrl+C, then npm run dev)');
    console.log('2. Or wait 5 minutes for cache to expire automatically');
    console.log('3. Then refresh the dashboard (Ctrl+F5)');
  }
}

// Run the test
clearCacheAndTest();







