const axios = require("axios");

let data;

const getOsuFilename = () =>
    `${data?.menu.bm.path.folder}/${data?.menu.bm.path.file}` || false;
const getSkinFolder = () => data?.settings.folders.skin || false;
const getBeatmapId = () => data?.menu.bm.id || false;
const getBeatmapsetId = () => data?.menu.bm.set || false;

const awaitTimer = (ms) =>
    new Promise((res) => {
        setTimeout(() => {
            res();
        }, ms);
    });

const listenOsuMemoryProvider = async () => {
    while (true) {
        let response = await axios
            .get("http://localhost:24050/json")
            .catch((e) => {
                console.log(`Cannot parse gOsuMemory`);
            });
        if (response?.status === 200) {
            data = response.data;
            await awaitTimer(500);
        } else await awaitTimer(2000);
    }
};

module.exports = {
    listenOsuMemoryProvider,
    getOsuFilename,
    getSkinFolder,
    getBeatmapId,
    getBeatmapsetId,
};
