require('dotenv').config();
const { AiService } = require('./dist/ai/ai.service');

async function testGameTurn() {
    const aiService = new AiService();
    
    console.log('Testing Game Turn generation...');
    console.log('API Key:', process.env.GOOGLE_API_KEY?.substring(0, 20) + '...');
    
    try {
        const result = await aiService.generateGameTurn(
            "I want to explore a mysterious dark forest",
            [],
            "fantasy",
            process.env.GOOGLE_API_KEY,
            process.env.POLLINATIONS_TOKEN
        );
        
        console.log('\n✅ SUCCESS! Game Turn generated:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('\n❌ FAILED:', error.message);
        console.error(error.stack);
    }
}

testGameTurn();
