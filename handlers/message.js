const twitchClient = require("../utils/twitchClient");
const {
    calculatePerformancePoints,
    getLocalBeatmapInfo,
} = require("../utils/oppai");
const { getSkinFolder, getBeatmapId } = require("../utils/listenProvider");

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
            const mapData = await getLocalBeatmapInfo();
            const beatmapId = await getBeatmapId();
            if (mapData !== "null") {
                let mapLink =
                    beatmapId && beatmapId > 0
                        ? `(https://osu.ppy.sh/beatmaps/${beatmapId})`
                        : `(карты нет на сайте)`;
                twitchClient.say(
                    channel,
                    `/me > ${tags.username} Сейчас играет ${mapData.artist} - ${mapData.title} [${mapData.version}] ${mapLink}`
                );
            } else
                twitchClient.say(
                    channel,
                    `/me > ${tags.username} Эта команда сейчас недоступна :(`
                );
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
        case "!skin":
            const skinFolder = await getSkinFolder();
            twitchClient.say(
                channel,
                `${tags.username} > Текущий скин: ${skinFolder}`
            );
            break;
        default:
    }
};

module.exports = Message;
