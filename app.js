const twitchClient = require("./utils/twitchClient");
const config = require("config");
const { Message, Redeem } = require("./handlers");
const osu = require("node-osu");
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
});
