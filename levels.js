const sqlite3 = require("sqlite3"),
    { open } = require("sqlite");

function getTimeNow() {
    return parseInt(Math.round(new Date().getTime() / 1000));
}

class Levels {
    constructor(database) {
        open({
            filename: database,
            driver: sqlite3.Database
        }).then(async db => {
            this.db = db;
            await this.db.run(`CREATE TABLE IF NOT EXISTS "users" (
                "id" INTEGER,
                "username" TEXT,
                "twitch_id" INTEGER NOT NULL,
                "last_action" INTEGER NOT NULL,
                "experience" INTEGER NOT NULL,
                "level" INTEGER NOT NULL,
                PRIMARY KEY ("id" AUTOINCREMENT))`);
            setInterval(await this.checkLevels,30000);
        });
    }

    async checkLevels() {
        let dayTimer = getTimeNow() - 86400,
            users = await this.db.all(`SELECT * FROM users WHERE last_action >= '${dayTimer}' ORDER BY id DESC`);
        for (let user of users) {

        }
    }

    async getUser(username) {
        let row = await this.db.get(`SELECT * FROM users WHERE username = '${username}' LIMIT 1`);
        if (row) return row;
        return false;
    }

    async createUser(username,id) {
        await this.db.run(`INSERT INTO users (username,twitch_id) VALUES ('${username}','${id}')`);
        return await this.getUser(username);
    }

    getExperience(lvl) {
        return parseInt((((lvl-1) * 1.3) * 50) + (Math.pow((lvl*1.2),2) * 120));
    }

    getLevel(exp,lvl = 1) {
        let checker = this.getExperience(lvl);
        return checker === exp ? lvl : this.getLevel(exp,lvl+1);
    }

    async truncateTables() {
        await this.db.run(`DROP TABLE users`);
    }
}

module.exports = new Levels("./database/levels.sqlite");