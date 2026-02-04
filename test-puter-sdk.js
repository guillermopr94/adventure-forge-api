
const { puter } = require('@heyputer/puter.js');

async function testPuterSDK() {
    console.log("Testing Puter SDK in Node.js...");
    try {
        console.log("Puter object keys:", Object.keys(puter));
        const response = await puter.ai.chat("Say hello world", { model: "gpt-4o-mini" });
        console.log("Response:", response);
    } catch (e) {
        console.error("SDK Error:", e.message);
    }
}

testPuterSDK();
