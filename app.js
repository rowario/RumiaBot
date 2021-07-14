const twitchClient = require("./api/twitchClient");
const { Message, Redeem } = require("./handlers");
const { listenOsuMemoryProvider } = require("./api/memoryProvider");
const { connectToBancho } = require("./api/banchoClient");
const { initCommands } = require("./database/commands");
const { initRewards } = require("./database/rewards");
const { initSkins } = require("./database/skins");

twitchClient.on("message", Message);
twitchClient.on("redeem", Redeem);

twitchClient.connect().then(async () => {
    console.log("Connected to Twitch");
    await initCommands();
    await initRewards();
    await initSkins();
    await connectToBancho();
    await listenOsuMemoryProvider();
    console.log("Bot is ready!");
});
