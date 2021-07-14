const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

let db;

const initSkins = () => {
    return new Promise((resolve) => {
        open({
            filename: "./database/skins.sqlite",
            driver: sqlite3.Database,
        })
            .then(async (responseDb) => {
                db = responseDb;
                await db.run(
                    `CREATE TABLE IF NOT EXISTS "skins"
                        ("id" INTEGER,"name" VARCHAR(255),"link" VARCHAR(255), PRIMARY KEY ("id" AUTOINCREMENT))`
                );
                console.log(`Skins initialized`);
                resolve(true);
            })
            .catch(() => {
                resolve(false);
            });
    });
};

const bindSkins = async (name, link) => {
    let skinCheck = await db.get(`SELECT * FROM skins WHERE name = ?`, name);
    if (skinCheck) return false;
    let added = await db.run(
        `INSERT INTO skins (name,link) VALUES (?,?)`,
        name,
        link
    );
    return !!added;
};

const unbindSkin = async (name) => {
    try {
        await db.run(`DELETE FROM skins WHERE name = ?`, name);
    } catch (error) {
        return false;
    }
    return true;
};

const findSkin = async (name) => {
    try {
        const data = await db.get(`SELECT * FROM skins WHERE name = ?`, name);
        return JSON.parse(data.data);
    } catch (error) {
        return false;
    }
};

const truncateTables = async () => {
    await db.run(`DROP TABLE skins`);
};

module.exports = {
    initSkins,
    bindSkins,
    unbindSkin,
    findSkin,
};
