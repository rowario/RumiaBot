const path = require("path");
const { spawn } = require("child_process");

const startMemoryProcess = () => {
    return new Promise((resolve) => {
        const exe = path.resolve(__dirname, "../memory/BotDataProvider");
        console.log("[MEMORY] Starting memory reading server");
        const process = spawn(exe);
        process.stdout.on("data", (data) => {
            console.log(
                `[MEMORY] ` + data.toString().trim().replace(/\r?\n/g, "")
            );
            resolve(true);
        });
        process.stderr.on("data", () => {
            console.log("[MEMORY] Memory process crashed, creating new one...");
            process.stdin.pause();
            process.kill();
            startMemoryProcess();
        });
    });
};

module.exports = {
    startMemoryProcess,
};
