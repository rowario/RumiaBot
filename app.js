const twitchClient = require("./utils/twitchClient");
const { Message, Redeem } = require("./handlers");
const { listenOsuMemoryProvider } = require("./utils/memoryProvider");
const { connectToBancho } = require("./utils/banchoClient");
const { initCommands } = require("./database/commands");
const { initRewards } = require("./database/rewards");

twitchClient.on("message", Message);
twitchClient.on("redeem", Redeem);

twitchClient.connect().then(async () => {
    console.log("Connected to Twitch");
    await initCommands();
    await initRewards();
    await listenOsuMemoryProvider();
    await connectToBancho();
    console.log("Bot is ready!");
});
