const path = require("path");
const { execFile } = require("child_process");

const startMemoryProcess = () => {
    const exe = path.resolve(__dirname, "../memory/BotDataProvider");
    console.log("Starting memory reader process...");
    execFile(exe, (error, _, stderr) => {
        if (error) {
            console.error(stderr);
            console.error("Error running osu! memory reader:");
            console.error(error);
            startMemoryProcess();
        }
    });
};

module.exports = {
    startMemoryProcess,
};
