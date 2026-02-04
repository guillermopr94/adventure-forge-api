async function waitAndTest() {
    console.log('Waiting 90 seconds for Render to deploy...');
    await new Promise(resolve => setTimeout(resolve, 90000));
    
    console.log('\nTesting production endpoint...');
    
    const url = 'https://adventure-forge-api.onrender.com/game/stream';
    const headers = {
        'Content-Type': 'application/json',
        'x-google-api-key': 'AIzaSyAZnRVnaxPU_ZiG6b6_qiZ4js1f09pp5mM',
        'x-pollinations-token': 'sk_qJKIORcEuDFv9NH47Y9UBz5MVSMwsJal'
    };
    const body = {
        prompt: "A brave knight enters a dark castle",
        history: [],
        genre: "fantasy",
        lang: "en"
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.error('❌ Error Status:', response.status);
            const text = await response.text();
            console.error('Error Body:', text);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            fullResponse += chunk;
            console.log('Chunk received:', chunk);
        }

        console.log('\n✅ Full Response:', fullResponse);
        
        // Check if response contains actual narrative
        if (fullResponse.includes('"paragraphs"') || fullResponse.length > 100) {
            console.log('\n🎉 SUCCESS! API is generating narrative correctly!');
        } else {
            console.log('\n⚠️ WARNING: Response is too short or missing narrative.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

waitAndTest();
