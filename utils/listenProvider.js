const WebSocket = require("ws");
let data = {
    beatmapId: 0,
    beatmapsetId: 0,
    skinFolderName: "",
    osuFile: "",
};

const getOsuFilename = () => data.osuFile;
const getSkinFolder = () => data.skinFolderName;
const getBeatmapId = () => data.beatmapId;
const getBeatmapsetId = () => data.beatmapsetId;

const listenOsuMemoryProvider = () => {
    const ws = new WebSocket(`ws://localhost:16057/data`);
    let countMessages = 0;

    ws.onopen = () => {
        console.log("successfully connected to osu! memory parser!");
        setTimeout(() => {
            if (countMessages === 0) process.exit(0);
        }, 10000);
    };

    ws.onmessage = (message) => {
        const response = JSON.parse(message.data);
        if (JSON.stringify(data) !== JSON.stringify(response)) {
            data = response;
        }

        countMessages++;
    };

    ws.onclose = () => {
        console.log("Disconnected from osu! memory parser, reconnecting...");
        setTimeout(() => listenOsuMemoryProvider(), 1000);
    };

    ws.onerror = () => {};
};

module.exports = {
    listenOsuMemoryProvider,
    getOsuFilename,
    getSkinFolder,
    getBeatmapId,
    getBeatmapsetId,
};
