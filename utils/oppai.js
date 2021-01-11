const ojsama = require("ojsama");
const config = require("config");
const fetch = require("node-fetch");
const fs = require("fs");
const parser = new ojsama.parser();
const { getOsuFilename } = require("./memoryProvider");

const calculatePerformancePoints = async (
    id = null,
    mods = "",
    accuracy = 100
) => {
    return new Promise(async (res) => {
        const fileName = id === null ? getOsuFileLocal() : await getOsuFile(id);
        if (fileName) {
            fs.readFile(fileName, "utf-8", async (err, data) => {
                try {
                    parser.reset();
                    parser.feed(data);
                    const stars = new ojsama.diff().calc({
                        map: parser.map,
                        mods: ojsama.modbits.from_string(mods),
                    });
                    const ppResponse = ojsama.ppv2({
                        stars,
                        acc_percent: accuracy,
                    });
                    return res({
                        pp: ppResponse.total.toFixed(2),
                        stars: stars.total.toFixed(2),
                    });
                } catch {
                    res(false);
                }
            });
        } else return res({});
    });
};

const getLocalBeatmapInfo = () => {
    return new Promise(async (res) => {
        fs.readFile(getOsuFileLocal(), "utf-8", async (err, data) => {
            parser.reset();
            parser.feed(data);
            return res(parser.map);
        });
    });
};

const getOsuFileLocal = () => `${config.get("osu").folder}${getOsuFilename()}`;

const getOsuFile = (id) => {
    return new Promise((res) => {
        const fileName = `./beatmaps/${id}.osu`;
        if (!fs.existsSync(fileName)) {
            return fetch(`https://osu.ppy.sh/osu/${id}`)
                .then((response) => response.text())
                .then((data) => {
                    fs.writeFile(fileName, data, (err) => {
                        if (err) return res(false);
                        return res(fileName);
                    });
                })
                .catch(() => {
                    return res(false);
                });
        } else return res(fileName);
    });
};

module.exports = {
    getOsuFile,
    getOsuFileLocal,
    calculatePerformancePoints,
    getLocalBeatmapInfo,
};
