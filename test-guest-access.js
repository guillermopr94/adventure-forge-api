const axios = require('axios');

async function testEndpoints() {
    console.log('Testing endpoints without auth...');
    const baseUrl = 'http://localhost:3001';
    
    try {
        console.log('\n--- Testing Text Generation ---');
        const textRes = await axios.post(`${baseUrl}/ai/text`, {
            prompt: 'Tell me a very short joke'
        });
        console.log('Text Response:', textRes.data);
    } catch (e) {
        console.error('Text Error:', e.response?.status, e.response?.data || e.message);
    }

    try {
        console.log('\n--- Testing Image Generation ---');
        const imgRes = await axios.post(`${baseUrl}/ai/image`, {
            prompt: 'A tiny cute robot'
        });
        console.log('Image Response: (Success - data received)');
    } catch (e) {
        console.error('Image Error:', e.response?.status, e.response?.data || e.message);
    }

    try {
        console.log('\n--- Testing Audio Generation ---');
        const audioRes = await axios.post(`${baseUrl}/ai/audio`, {
            text: 'Hello world',
            voice: 'alloy',
            lang: 'en'
        });
        console.log('Audio Response: (Success - data received)');
    } catch (e) {
        console.error('Audio Error:', e.response?.status, e.response?.data || e.message);
    }
}

testEndpoints();
