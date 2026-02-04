const dns = require('dns').promises;

const variations = [
    "adventureforce.hs8xl11.mongodb.net",
    "adventureforge.hs8xl11.mongodb.net",
    "adventure-force.hs8xl11.mongodb.net",
    "adventure-forge.hs8xl11.mongodb.net"
];

async function check() {
    for (const host of variations) {
        try {
            console.log(`Checking ${host}...`);
            await dns.resolveSrv(`_mongodb._tcp.${host}`);
            console.log(`FOUND!! ${host} works.`);
        } catch (e) {
            console.log(`${host} failed: ${e.code}`);
        }
    }
}

check();
