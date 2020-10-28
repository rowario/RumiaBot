const sqlite3 = require("sqlite3"),
    { open } = require("sqlite");

class Levels {
    constructor(database) {
        open({
            filename: database,
            driver: sqlite3.Database
        }).then(async db => {
            this.db = db;
            await this.db.run(`CREATE TABLE IF NOT EXISTS "users" ("id" INTEGER, "username" TEXT, "twitch_id" INTEGER, PRIMARY KEY ("id" AUTOINCREMENT))`);
        });
    }

    async getUser(username) {
        let row = await this.db.get(`SELECT * FROM users WHERE username = '${username}' LIMIT 1`);
        if (row) return row;
        return false;
    }

    async truncateTables() {
        await this.db.run(`DROP TABLE users`);
    }
}

module.exports = new Levels("./database/levels.sqlite");