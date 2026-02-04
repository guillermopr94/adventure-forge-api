
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env.POLLINATIONS_TOKEN;

async function testAudio() {
    console.log("\n--- Testing Audio Generation ---");
    const text = "Hello world";
    const encodedText = encodeURIComponent(text);

    // Attempt 1: GET with Query Param (openai-audio)
    const url1 = `https://gen.pollinations.ai/text/${encodedText}?model=openai-audio&voice=alloy&key=${token}`;

    try {
        console.log("Attempt 1: GET request");
        console.log("URL:", url1.replace(token || '', '***'));
        const res = await fetch(url1);
        console.log("Status:", res.status);
        if (!res.ok) console.log("Body:", await res.text());
        else {
            const buff = await res.arrayBuffer();
            console.log("Success: Audio Buffer received (size: " + buff.byteLength + ")");
        }
    } catch (e) { console.error("Error:", e); }

    // Attempt 2: POST request (if GET fails or for comparison)
    const url2 = "https://gen.pollinations.ai/v1/audio/speech"; // Theoretical endpoint based on OpenAI compatibility
    try {
        console.log("\nAttempt 2: POST to /v1/audio/speech (OpenAI compatible)");
        const res = await fetch(url2, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                model: "tts-1", // or openai-audio
                input: text,
                voice: "alloy"
            })
        });
        console.log("Status:", res.status);
        if (!res.ok) console.log("Body:", await res.text());
        else {
            const buff = await res.arrayBuffer();
            console.log("Success: Audio Buffer received (size: " + buff.byteLength + ")");
        }
    } catch (e) { console.error("Error:", e); }
}

(async () => {
    await testAudio();
})();
