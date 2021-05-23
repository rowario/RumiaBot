const twitchClient = require("./api/twitchClient");
const { Message, Redeem } = require("./handlers");
const { listenOsuMemoryProvider } = require("./api/memoryProvider");
const { connectToBancho } = require("./api/banchoClient");
const { initCommands } = require("./database/commands");
const { initRewards } = require("./database/rewards");

twitchClient.on("message", Message);
twitchClient.on("redeem", Redeem);

twitchClient.connect().then(async () => {
    console.log("Connected to Twitch");
    await initCommands();
    await initRewards();
    await connectToBancho();
    await listenOsuMemoryProvider();
    console.log("Bot is ready!");
});
