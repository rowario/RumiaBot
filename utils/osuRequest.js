const config = require("config");
const url = require("url");
const osu = require("node-osu");
const { bancho } = require("./banchoClient");
const { calculatePerformancePoints } = require("../utils/oppai");
const osuApi = new osu.Api(config.get("osu").apiToken, {
    notFoundAsError: true,
    completeScores: true,
    parseNumeric: false,
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

const sendRequest = (command, osuLinkData, sender, text = "") => {
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
                    ppAccString.push(`${acc}%: ${parseInt(getOppai.pp)}PP`);
                }
                const message = `{username} > {text} {dllink} {mods} {mapstat}`
                    .replace(/{username}/, sender)
                    .replace(/{text}/, `${text.toUpperCase()}: `)
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
                bancho.sendMessage(message.trim());
                resolve(true);
            })
            .catch(() => {
                resolve(false);
            });
    });
};

module.exports = {
    sendRequest,
};
