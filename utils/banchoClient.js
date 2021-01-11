const config = require("config");
const { BanchoClient } = require("bancho.js");
const banchoIrc = new BanchoClient({
    username: config.get("osuIrc").login,
    password: config.get("osuIrc").password,
});

const bancho = banchoIrc.getSelf();

const connectToBancho = () => {
    banchoIrc
        .connect()
        .then(() => {
            console.log(`Connected to Bancho!`);
        })
        .catch(() => {
            console.log(`Cannot connect to Bancho!`);
        });
};

module.exports = {
    bancho,
    connectToBancho,
};
