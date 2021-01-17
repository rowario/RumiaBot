const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

var db;

const initRewards = () => {
    return new Promise((resolve) => {
        open({
            filename: "./database/rewards.sqlite",
            driver: sqlite3.Database,
        })
            .then(async (responseDb) => {
                db = responseDb;
                await db.run(
                    `CREATE TABLE IF NOT EXISTS "rewards"
                        ("id" INTEGER,"key" VARCHAR(255),"type" VARCHAR(255), "data" TEXT, PRIMARY KEY ("id" AUTOINCREMENT))`
                );
                console.log(`Rewards initialized`);
                resolve(true);
            })
            .catch(() => {
                resolve(false);
            });
    });
};

const bindReward = async (rewardKey, command) => {
    const type = command[1];
    const data = {};
    switch (type) {
        case "request":
            data.text = Array.from(command).splice(2, command.length).join(" ");
            break;
    }
    try {
        await db.run(
            `INSERT INTO rewards (key,data,type) VALUES (?,?,?)`,
            rewardKey,
            JSON.stringify(data),
            type
        );
    } catch (e) {
        return false;
    }
    return true;
};

const unbindReward = async (rewardKey) => {
    try {
        await db.run(`DELETE FROM rewards WHERE key = ?`, rewardKey);
    } catch (error) {
        return false;
    }
    return true;
};

const getRewardData = async (rewardKey) => {
    try {
        const data = await db.get(
            `SELECT * FROM rewards WHERE key = ?`,
            rewardKey
        );
        return JSON.parse(data.data);
    } catch (error) {
        return false;
    }
};

const truncateTables = async () => {
    await db.run(`DROP TABLE commands`);
    await db.run(`DROP TABLE aliases`);
};

module.exports = {
    initRewards,
    bindReward,
    unbindReward,
    getRewardData,
};
