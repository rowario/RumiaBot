const config = require("config");
const { BanchoClient } = require("bancho.js");
const banchoIrc = new BanchoClient({
    username: config.get("osuIrc").login,
    password: config.get("osuIrc").password,
});

const bancho = banchoIrc.getSelf();

const connectToBancho = () => {
    return new Promise((resolve) => {
        banchoIrc
            .connect()
            .then(() => {
                console.log(`Connected to Bancho`);
                resolve(true);
            })
            .catch(() => {
                console.log(`Cannot connect to Bancho`);
                resolve(false);
            });
    });
};

module.exports = {
    bancho,
    connectToBancho,
};
