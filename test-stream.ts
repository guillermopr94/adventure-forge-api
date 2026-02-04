
const http = require('http');

function testStream() {
    console.log("--- Testing Stream Endpoint (Native HTTP) ---");

    const postData = JSON.stringify({
        prompt: "Start the game",
        history: [],
        voice: "alloy",
        genre: "fantasy",
        lang: "en"
    });

    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/game/stream',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    };

    const req = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

        res.setEncoding('utf8');

        res.on('data', (chunk) => {
            console.log(`Received chunk: ${chunk}`);
        });

        res.on('end', () => {
            console.log('No more data in response.');
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    // Write data to request body
    req.write(postData);
    req.end();
}

testStream();
