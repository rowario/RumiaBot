const ojsama = require("ojsama");
const config = require("config");
const fetch = require("node-fetch");
const fs = require("fs");
const parser = new ojsama.parser();

const calculatePerformancePoints = async (
    id = null,

    mods = "",
    accuracy = 100
) => {
    return new Promise(async (res) => {
        const fileName =
            id === null ? await getOsuFileLocal() : await getOsuFile(id);
        if (fileName) {
            fs.readFile(fileName, "utf-8", async (err, data) => {
                parser.feed(data);
                const stars = new ojsama.diff().calc({
                    map: parser.map,
                    mods: ojsama.modbits.from_string(mods),
                });
                const ppResponse = ojsama.ppv2({
                    stars,
                    acc_percent: accuracy,
                });
                parser.reset();
                return res({
                    pp: ppResponse.total.toFixed(2),
                    stars: stars.total.toFixed(2),
                });
            });
        } else return res({});
    });
};

const getOsuFileLocal = () => {
    return fetch("http://localhost:24050/json")
        .then((response) => response.json())
        .then((data) => {
            if (data !== "null") {
                return (
                    `${config.get("osu").folder}` +
                    `${data.menu.bm.path.folder}\\${data.menu.bm.path.file}`
                );
            } else return false;
        })
        .catch(() => {
            return false;
        });
};

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
};

// function _calculateDTAR(ms) {
//     if (ms < 300) {
//         return 11;
//     } else if (ms < 1200) {
//         return 11 - (ms - 300) / 150;
//     }
//     return 5 - (ms - 1200) / 120;
// }
//
// function _calculateAR(modifiers, ar) {
//     let ms;
//     switch (modifiers) {
//         case "HR":
//             return Math.min(10, ar * 1.4);
//         case "EZ":
//             return ar / 2;
//
//         case "DTHR": {
//             if (ar < 4) {
//                 ms = 1200 - 112 * ar;
//             } else if (ar > 4) {
//                 ms = 740 - 140 * (ar - 4);
//             } else {
//                 ms = 864 - 124 * (ar - 3);
//             }
//             return _calculateDTAR(ms);
//         }
//         case "DTEZ":
//             return _calculateDTAR(1200 - 40 * ar);
//
//         case "DT":
//             return _calculateDTAR(
//                 ar > 5 ? 200 + (11 - ar) * 100 : 800 + (5 - ar) * 80
//             );
//         case "HT": {
//             if (ar === 5) return 0;
//             if (ar < 5) return -1.5 * (5 - ar);
//             if (ar < 8) return 1.875 * ar;
//             return 4 + 1.5 * (ar - 7);
//         }
//
//         case "HTHR": {
//             if (ar > 7) return 8.5;
//             if (ar < 4) {
//                 ms = 2700 - 252 * ar;
//             } else if (ar < 5) {
//                 ms = 1944 - 279 * (ar - 3);
//             } else {
//                 ms = 1665 - 315 * (ar - 4);
//             }
//             if (ar < 6) {
//                 return 15 - ms / 120;
//             } else if (ar > 7) {
//                 return 13 - ms / 150;
//             }
//             return 15 - ms / 120;
//         }
//         case "HTEZ":
//             return -0.75 * (10 - ar);
//
//         default:
//             return ar;
//     }
// }
