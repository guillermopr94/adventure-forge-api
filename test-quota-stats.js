const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function testQuotaStats() {
    try {
        console.log('Testing GET /ai/quota-stats...');
        const response = await axios.get(`${API_URL}/ai/quota-stats`);
        
        console.log('✅ Quota Stats Response:', JSON.stringify(response.data, null, 2));
        
        if (response.data.total !== undefined && response.data.success !== undefined) {
            console.log('✅ Test PASSED: Quota stats endpoint works correctly');
        } else {
            console.log('❌ Test FAILED: Invalid response structure');
        }
    } catch (error) {
        console.error('❌ Test FAILED:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testQuotaStats();
