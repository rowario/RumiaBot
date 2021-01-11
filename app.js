const twitchClient = require("./utils/twitchClient");
const { Message, Redeem } = require("./handlers");
const { listenOsuMemoryProvider } = require("./utils/memoryProvider");
const { connectToBancho } = require("./utils/banchoClient");
const { startMemoryProcess } = require("./utils/memoryProcess");

twitchClient.on("message", Message);
twitchClient.on("redeem", Redeem);

twitchClient.connect().then(async () => {
    console.log("Connected to Twitch");
    await startMemoryProcess();
    await listenOsuMemoryProvider();
    await connectToBancho();
    console.log("Bot is ready!");
});
