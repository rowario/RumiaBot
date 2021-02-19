const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

var db;

const initCommands = () => {
    return new Promise((resolve) => {
        open({
            filename: "./database/commands.sqlite",
            driver: sqlite3.Database,
        })
            .then(async (responseDb) => {
                db = responseDb;
                await db.run(
                    `CREATE TABLE IF NOT EXISTS "commands" ("id" INTEGER, "answer" TEXT, PRIMARY KEY ("id" AUTOINCREMENT))`
                );
                await db.run(
                    `CREATE TABLE IF NOT EXISTS "aliases" ("id" INTEGER, "command_id" INTEGER, "alias" TEXT, PRIMARY KEY ("id" AUTOINCREMENT))`
                );
                console.log(`Commands initialized`);
                resolve(true);
            })
            .catch(() => {
                resolve(false);
            });
    });
};

const createCommand = async (aliases, answer) => {
    let aliasesArr = aliases.split("/").map((x) => x.toLowerCase());
    if (await checkAliases(aliasesArr)) return false;
    let stmt = await db.run(`INSERT INTO commands (answer) VALUES (?)`, answer);
    for await (let alias of aliasesArr)
        await db.run(
            `INSERT INTO aliases (alias,command_id) VALUES (?,?)`,
            alias,
            stmt.lastID
        );
    return true;
};

const checkAliases = async (aliasesArr) => {
    return new Promise(async (res) => {
        let count = 0;
        for (let alias of aliasesArr) {
            let res = await db.get(
                `SELECT * FROM aliases WHERE alias = ?`,
                alias
            );
            if (res) count++;
        }
        if (count > 0) res(true);
        res(false);
    });
};

const getCommand = async (alias) => {
    let row = await db.get(
        `SELECT * FROM commands WHERE id IN (SELECT command_id FROM aliases WHERE lower(alias) = ?)`,
        alias.toLowerCase()
    );
    if (row) return row;
    return false;
};

const deleteCommand = async (alias) => {
    if (await checkAliases(alias)) return false;
    let command_id = await db.get(
        `SELECT command_id FROM aliases WHERE alias = ?`,
        alias
    );
    if (!command_id) {
        return false;
    } else {
        await db.run(
            `DELETE FROM aliases WHERE command_id = ?`,
            command_id.command_id
        );
        await db.run(
            `DELETE FROM commands WHERE id = ?`,
            command_id.command_id
        );
        return true;
    }
};

const editCommand = async (alias, newAnswer) => {
    let command = await getCommand(alias);
    if (!command) return false;
    await db.run(
        `UPDATE commands SET answer = ? WHERE id = ?`,
        newAnswer,
        command.id
    );
    return await getCommand(alias);
};

const addAlias = async (alias, newAlias) => {
    let command = await getCommand(alias);
    if (!command) return false;
    await db.run(
        `INSERT INTO aliases (alias,command_id) VALUES (?,?)`,
        newAlias,
        command.id
    );
    return true;
};

const deleteAlias = async (alias) => {
    await db.run(`DELETE FROM aliases WHERE alias = ?`, alias);
    return true;
};

const truncateTables = async () => {
    await db.run(`DROP TABLE commands`);
    await db.run(`DROP TABLE aliases`);
};

module.exports = {
    initCommands,
    createCommand,
    checkAliases,
    getCommand,
    deleteCommand,
    editCommand,
    addAlias,
    deleteAlias,
};
