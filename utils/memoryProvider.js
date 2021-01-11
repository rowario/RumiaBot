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
    return new Promise((resolve) => {
        const ws = new WebSocket(`ws://localhost:16057/data`);
        let countMessages = 0;

        ws.onopen = () => {
            console.log("Connected to memory websocket");
            setTimeout(() => {
                if (countMessages === 0) process.exit(0);
            }, 10000);
            resolve(true);
        };

        ws.onmessage = (message) => {
            const response = JSON.parse(message.data);
            if (JSON.stringify(data) !== JSON.stringify(response))
                data = response;
            countMessages++;
        };

        ws.onclose = () => {
            process.stdout.write("-");
            listenOsuMemoryProvider();
        };

        ws.onerror = () => {};
    });
};

module.exports = {
    listenOsuMemoryProvider,
    getOsuFilename,
    getSkinFolder,
    getBeatmapId,
    getBeatmapsetId,
};
