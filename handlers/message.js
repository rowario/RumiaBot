const twitchClient = require("../utils/twitchClient");
const { calculatePerformancePoints } = require("../utils/oppai");
const fetch = require("node-fetch");

const randomInteger = (min, max) => {
    let rand = min - 0.5 + Math.random() * (max - min + 1);
    return Math.round(rand);
};

const Message = async (channel, tags, message, self) => {
    if (self) return;
    // TODO
    const command = message.split(" ");
    switch (command[0].toLowerCase()) {
        case "!iq":
        case "!коэффициентинтеллекта":
            let selfCheck = !(
                    message.match(/@/gi) &&
                    command[1].replace(/@/gi, "") !== `${tags.username}`
                ),
                checkUser = selfCheck
                    ? tags.username
                    : command[1].replace(/@/, "");
            let randIq = randomInteger(1, 250);
            if (checkUser === "rowario") randIq = 999;
            if (checkUser === "robloxxa") randIq = -1;
            twitchClient.say(
                channel,
                selfCheck
                    ? `/me > ${tags.username} твой IQ ${randIq}`
                    : `/me > ${tags.username} ты проверил iq у ${checkUser}, у него ${randIq}`
            );
            break;
        case "!np":
        case "!нп":
        case "!song":
        case "!карта":
            fetch("http://localhost:24050/json")
                .then((response) => response.json())
                .then((data) => {
                    if (data !== "null") {
                        let bm = data.menu.bm,
                            mapd = bm.metadata,
                            mapLink =
                                bm.id !== 0
                                    ? `(https://osu.ppy.sh/beatmaps/${bm.id})`
                                    : `(карты нет на сайте)`;
                        twitchClient.say(
                            channel,
                            `/me > ${tags.username} Сейчас играет ${mapd.artist} - ${mapd.title} [${mapd.difficulty}] ${mapLink}`
                        );
                    } else
                        twitchClient.say(
                            channel,
                            `/me > ${tags.username} Эта команда сейчас недоступна :(`
                        );
                });
            break;
        case "!pp":
        case "!iffc":
        case "!пп":
        case "!пепе":
            let mods = "";
            let accuracy = 100;
            for (let i = 1; i <= 10; i++) {
                if (command[i]) {
                    accuracy = Number(command[i])
                        ? parseInt(command[i])
                        : accuracy;
                    mods = !Number(command[i])
                        ? (mods += command[i].toString())
                        : mods;
                }
            }
            const pp = await calculatePerformancePoints(null, mods, accuracy);
            twitchClient.say(
                channel,
                `${tags.username} > ${pp.pp} ${command[0]
                    .substr(1)
                    .toUpperCase()}`
            );
            break;
        default:
    }
};

module.exports = Message;
