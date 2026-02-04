async function detailedTest() {
    const url = 'https://adventure-forge-api.onrender.com/game/stream';
    const headers = {
        'Content-Type': 'application/json',
        'x-google-api-key': 'AIzaSyAZnRVnaxPU_ZiG6b6_qiZ4js1f09pp5mM',
        'x-pollinations-token': 'sk_qJKIORcEuDFv9NH47Y9UBz5MVSMwsJal'
    };
    const body = {
        prompt: "Enter a dark castle",
        history: [],
        genre: "fantasy",
        lang: "en",
        voice: "alloy"
    };

    console.log('🔍 Testing Production API with detailed logging...\n');
    console.log('Headers:', Object.keys(headers).join(', '));
    console.log('Body:', JSON.stringify(body, null, 2));
    console.log('\n--- Starting Request ---\n');

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        console.log('Status:', response.status, response.statusText);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const text = await response.text();
            console.error('\n❌ Error Response:', text);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let chunkCount = 0;
        let events = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('\n--- Stream Ended ---');
                break;
            }
            
            const chunk = decoder.decode(value);
            chunkCount++;
            
            console.log(`\nChunk #${chunkCount}:`);
            console.log(chunk);
            
            // Try to parse as JSON
            try {
                const parsed = JSON.parse(chunk);
                events.push(parsed);
                console.log('Parsed:', JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.log('(Not valid JSON, might be SSE format)');
            }
        }

        console.log('\n=== SUMMARY ===');
        console.log('Total chunks received:', chunkCount);
        console.log('Total events:', events.length);
        
        if (events.length > 0) {
            console.log('\nEvent types received:');
            events.forEach((evt, i) => {
                console.log(`  ${i + 1}. type="${evt.data?.type || evt.type || 'unknown'}"`, 
                    evt.data?.message ? `message="${evt.data.message}"` : '');
            });
        }

        // Check for expected events
        const hasTextStructure = events.some(e => e.data?.type === 'text_structure' || e.type === 'text_structure');
        const hasDone = events.some(e => e.data?.type === 'done' || e.type === 'done');
        
        if (hasTextStructure && hasDone) {
            console.log('\n✅ SUCCESS! API is working correctly.');
        } else if (hasDone && !hasTextStructure) {
            console.log('\n⚠️  WARNING: Received "done" but NO text_structure event.');
            console.log('This means generateGameTurn() is failing or returning empty data.');
        } else {
            console.log('\n❓ UNEXPECTED: Stream ended without proper completion.');
        }

    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
        console.error(error.stack);
    }
}

detailedTest();
