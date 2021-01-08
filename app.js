const twitchClient = require("./utils/twitchClient");
const config = require("config");
const { Message, Redeem } = require("./handlers");
const osu = require("node-osu");
const path = require("path");
const { execFile } = require("child_process");
const { listenOsuMemoryProvider } = require("./utils/listenProvider");
// const { BanchoClient } = require("bancho.js");

const osuClient = new osu.Api(config.get("osu").apiToken, {
    notFoundAsError: true,
    completeScores: true,
    parseNumeric: false,
});

// const banchoIrc = new BanchoClient({
//     username: config.get("osuIrc").login,
//     password: config.get("osuIrc").password,
// });

twitchClient.on("message", Message);
twitchClient.on("redeem", Redeem);

twitchClient.connect().then(async () => {
    console.log("Connected to Twitch");
    function startOsuMemoryReader() {
        const exe = path.resolve(__dirname, "./memory/BotDataProvider.exe");
        execFile(exe, (error, stdout, stderr) => {
            console.log("Starting memory...");
            if (error) {
                console.error(stderr);
                console.error("Error running osu! memory reader:");
                console.error(error);
                startOsuMemoryReader();
            }
        });
    }
    startOsuMemoryReader();
    listenOsuMemoryProvider();
});
