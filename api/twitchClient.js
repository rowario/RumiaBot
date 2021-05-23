const tmi = require("tmi.js");
const config = require("config");

const twitchClient = tmi.client({
    options: { debug: false },
    connection: {
        reconnect: true,
        secure: true,
    },
    identity: {
        username: config.get("twitch").bot,
        password: config.get("twitch").tmiToken,
    },
    channels: [config.get("twitch").channel],
});

module.exports = twitchClient;
