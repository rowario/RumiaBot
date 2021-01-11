const config = require("config");
const url = require("url");
const { BanchoClient } = require("bancho.js");
const osu = require("node-osu");
const { calculatePerformancePoints } = require("../utils/oppai");
const osuApi = new osu.Api(config.get("osu").apiToken, {
    notFoundAsError: true,
    completeScores: true,
    parseNumeric: false,
});
const banchoIrc = new BanchoClient({
    username: config.get("osuIrc").login,
    password: config.get("osuIrc").password,
});
const banchoSelf = banchoIrc.getSelf();

banchoIrc.connect().then(() => {
    console.log(`Connected to bancho!`);
});

const getMods = (data) => {
    let message = "";
    for (let i = 0; i < data.length; i++) {
        let item = url.parse(data[i]);
        message = item.host ? message : message + data[i];
    }
    const arrIndexes = ["hd", "dt", "nc", "hr", "ez", "nf", "ht", "v2"];
    let existMods = [];
    for (let item of arrIndexes)
        if (message.indexOf(item) > -1)
            if (!existMods.indexOf(item) > -1) existMods.push(item);
    return existMods;
};

const getBpm = (baseBpm, existMods) => {
    let dtCheck =
        existMods.indexOf("dt") > -1 || existMods.indexOf("nc") > -1
            ? parseInt(baseBpm * 1.5)
            : parseInt(baseBpm);
    return existMods.indexOf("ht") > -1
        ? parseInt(dtCheck * 0.75)
        : parseInt(dtCheck);
};

const sendRequestNew = (command, osuLinkData, sender) => {
    return new Promise((resolve) => {
        const mods = getMods(command);
        const getConfig =
            osuLinkData.type === "b"
                ? { b: osuLinkData.id }
                : { s: osuLinkData.id };
        osuApi
            .getBeatmaps(getConfig)
            .then(async (beatmaps) => {
                if (!beatmaps[0]) return;
                const map = beatmaps[0];
                const oppaiData = [];
                const ppAccString = [];
                for await (let acc of [95, 98, 99, 100]) {
                    let getOppai = await calculatePerformancePoints(
                        map.id,
                        mods.join(""),
                        acc
                    );
                    oppaiData.push(getOppai);
                    ppAccString.push(`${acc}%: ${getOppai.pp}PP`);
                }
                const message = `{username} > {dllink} {mods} {mapstat}`
                    .replace(/{username}/, sender)
                    .replace(
                        /{dllink}/,
                        `[https://osu.ppy.sh/b/${map.id} ${map.artist} - ${map.title}]`
                    )
                    .replace(
                        /{mods}/,
                        mods != "" ? `+${mods.join("").toUpperCase()}` : ""
                    )
                    .replace(
                        /{mapstat}/,
                        `(${getBpm(map.bpm, mods)} BPM, ${
                            oppaiData[0].stars
                        }⭐, ${ppAccString.join(", ")})`
                    );
                banchoSelf.sendMessage(message.trim());
                resolve(true);
            })
            .catch((err) => {
                resolve(false);
            });
    });
};

const sendRequest = (linkInfo, username, osuLink, customText = "") => {
    return new Promise((res) => {
        let getMapConfig =
            linkInfo.type === "b" ? { b: linkInfo.id } : { s: linkInfo.id };
        osuApi.getBeatmaps(getMapConfig).then(async (beatmaps) => {
            if (!beatmaps[0]) return;
            let mapInfo = beatmaps[0],
                oppaiData = [],
                ppAccString = [],
                mods = getMods(osuLink).toUpperCase();
            for await (let acc of [95, 98, 99, 100]) {
                let getOppai = await getOppaiData(mapInfo.id, mods, acc);
                oppaiData.push(getOppai);
                ppAccString.push(`${acc}%: ${getOppai.pp}PP`);
            }
            let starRate = oppaiData[0]
                    ? parseFloat(oppaiData[0].stats.sr).toFixed(2)
                    : parseFloat(mapInfo.difficultyrating).toFixed(2),
                genMsg = `{custom} {username} > {dllink} {mods} {mapstat}`
                    .replace(/{custom}/, customText)
                    .replace(/{username}/, username)
                    .replace(
                        /{dllink}/,
                        `[https://osu.ppy.sh/b/${mapInfo.id} ${mapInfo.artist} - ${mapInfo.title}]`
                    )
                    .replace(/{mods}/, mods)
                    .replace(
                        /{mapstat}/,
                        `(${getBpm(
                            mapInfo.bpm,
                            osuLink
                        )} BPM, ${starRate}⭐, ${ppAccString.join(", ")})`
                    );
            await banchoSelf.sendMessage(genMsg.trim());
            res({
                title: mapInfo.title,
                artist: mapInfo.artist,
                mods: mods,
            });
        });
    });
};

module.exports = {
    sendRequest,
    sendRequestNew,
};
