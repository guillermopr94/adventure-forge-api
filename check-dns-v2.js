const dns = require('dns').promises;

const variations = [
    "adventureforce.hs8xl11.mongodb.net",
    "adventureforge.hs8xl11.mongodb.net",
    "adventureforce.mongodb.net",
    "adventureforge.mongodb.net",
    "cluster0.hs8xl11.mongodb.net",
    "adventure.hs8xl11.mongodb.net"
];

async function check() {
    for (const host of variations) {
        try {
            console.log(`Checking SRV for ${host}...`);
            await dns.resolveSrv(`_mongodb._tcp.${host}`);
            console.log(`FOUND!! ${host} works.`);
        } catch (e) {
            // try normal A record too
            try {
               await dns.resolve(host);
               console.log(`FOUND A RECORD!! ${host} works.`);
            } catch(e2) {
               console.log(`${host} failed: SRV=${e.code}, A=${e2.code}`);
            }
        }
    }
}

check();
