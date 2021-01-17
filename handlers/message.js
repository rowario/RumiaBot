const url = require("url");
const twitchClient = require("../utils/twitchClient");
const { sendRequest } = require("../utils/osuRequest");
const Commands = require("../utils/commands");

const {
    calculatePerformancePoints,
    getLocalBeatmapInfo,
} = require("../utils/oppai");
const { getSkinFolder, getBeatmapId } = require("../utils/memoryProvider");

const Message = async (channel, tags, message, self) => {
    if (self) return;
    const command = message.split(" ");
    const link = parseLink(command);
    const parsedLink = url.parse(link);
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
            const beatmapId = getBeatmapId();
            if (mapData && mapData !== "null") {
                let mapLink =
                    beatmapId && beatmapId > 0
                        ? `(https://osu.ppy.sh/beatmaps/${beatmapId})`
                        : `(карта не загружена)`;
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
                        ? parseFloat(command[i])
                        : accuracy;
                    mods = !Number(command[i])
                        ? (mods += command[i].toString())
                        : mods;
                }
            }
            const pp = await calculatePerformancePoints(null, mods, accuracy);
            twitchClient.say(
                channel,
                pp
                    ? `${tags.username} > ${pp.pp} ${command[0]
                          .substr(1)
                          .toUpperCase()}`
                    : `${tags.username} > Не удалось обработать карту :(`
            );
            break;
        case "!skin":
        case "!currentskin":
        case "!текущийскин":
        case "!скин":
            const skinFolder = getSkinFolder();
            twitchClient.say(
                channel,
                `${tags.username} > Текущий скин: ${skinFolder}`
            );
            break;
        case "!bindskin":
            const currentSkin = getSkinFolder();
            break;
        case "!com":
            //TODO: Редактирование комманд из базы данных
            if (tags.badges.broadcaster || tags.badges.moderator) {
                let alias = command[2];
                let answer = Array.from(command)
                    .splice(3, command.length)
                    .join(" ");
                switch (command[1]) {
                    case "add":
                        let created = await Commands.createCommand(
                            alias,
                            answer
                        );
                        twitchClient.say(
                            channel,
                            created
                                ? `/me > ${tags.username}, команда ${
                                      alias.split("/")[0]
                                  } успешно добавлена`
                                : `/me > ${tags.username}, такая команда уже существует!`
                        );
                        break;
                    case "edit":
                        let edited = await Commands.editCommand(alias, answer);
                        twitchClient.say(
                            channel,
                            edited
                                ? `/me > ${tags.username}, команда ${command[2]} успешно обновлена!`
                                : `/me > ${tags.username}, не удалось обновить команду!`
                        );
                        break;
                    case "del":
                        let deleted = await Commands.deleteCommand(command[2]);
                        twitchClient.say(
                            channel,
                            deleted
                                ? `/me > ${tags.username}, команда ${command[2]} успешно удалена!`
                                : `/me > ${tags.username}, такой команды не существует`
                        );
                        break;
                    case "delalias":
                        let deletedAlias = await Commands.deleteAlias(alias);
                        twitchClient.say(
                            channel,
                            deletedAlias
                                ? `/me > ${tags.username}, алиас ${command[2]} успешно удален!`
                                : `/me > ${tags.username}, такой алиас не найден!`
                        );
                        break;
                    case "addalias":
                        let newAlias = command[3];
                        let addedAlias = await Commands.addAlias(
                            alias,
                            newAlias
                        );
                        twitchClient.say(
                            channel,
                            addedAlias
                                ? `/me > ${tags.username}, алиас ${newAlias} успешно добавлен!`
                                : `/me > ${tags.username}, такой алиас не найден!`
                        );
                        break;
                }
            }
            break;
        default:
            // Links & custom commands handlers
            // // Links
            if (
                parsedLink.host === "osu.ppy.sh" ||
                parsedLink.host === "old.ppy.sh" ||
                parsedLink.host === "osu.gatari.pw"
            ) {
                const parsedOsuLink = osuLinkParser(parsedLink);
                switch (parsedOsuLink.type) {
                    case "s":
                    case "b":
                        const sendResult = await sendRequest(
                            command,
                            parsedOsuLink,
                            tags.username
                        );
                        twitchClient.say(
                            channel,
                            sendResult
                                ? `${tags.username} > Реквест успешно отправлен!`
                                : `${tags.username} > Реквест не удалось отправить :(`
                        );
                        break;
                    case "p":
                    // Место под проверку профилей
                    default:
                        break;
                }
                return;
            }
            if (await Commands.getCommand(command[0])) {
                let answer = await Commands.getCommand(command[0]);
                twitchClient.say(channel, `/me > ${answer.answer}`);
            }
            break;
    }
};

const randomInteger = (min, max) =>
    Math.round(min - 0.5 + Math.random() * (max - min + 1));

const parseLink = (message) => {
    let strMsg = message.toString();
    return strMsg.indexOf("http") > -1
        ? strMsg.slice(strMsg.indexOf("http"), strMsg.length)
        : "";
};

const osuLinkParser = (linkData) => {
    let pathArr = linkData.path.split("/");
    if (["b", "beatmaps", "beatmapsets"].indexOf(pathArr[1]) > -1) {
        if (pathArr[1] === "beatmapsets" && linkData.hash !== null) {
            return { type: "b", id: parseInt(linkData.hash.split("/")[1]) };
        } else if (["b", "beatmaps"].indexOf(pathArr[1]) > -1) {
            return { type: "b", id: parseInt(pathArr[2]) };
        }
    }
    if (["s", "beatmapsets"].indexOf(pathArr[1]) > -1) {
        return { type: "s", id: parseInt(pathArr[2]) };
    }
    if (
        ["u", "users"].indexOf(pathArr[1]) > -1 &&
        ["osu.ppy.sh", "old.ppy.sh"].indexOf(linkData.host) > -1
    ) {
        return { type: "p", id: parseInt(pathArr[2]) };
    }
    return false;
};

module.exports = Message;
