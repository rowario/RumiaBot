const sqlite3 = require("sqlite3"),
    { open } = require("sqlite");

class Database {
    constructor(database) {
        open({
            filename: database,
            driver: sqlite3.Database
        }).then(db => {
            this.db = db;
        });
    }

    async createCommand(aliases,answer) {
        let aliasesArr = aliases.split("/");
        if (await this.checkAliases(aliasesArr)) return false;
        let stmt = await this.db.run(`INSERT INTO commands (answer) VALUES ('${answer}')`);
        for await (let alias of aliasesArr) await this.db.run(`INSERT INTO aliases (alias,command_id) VALUES ('${alias}',${stmt.lastID})`);
        return true;
    }

    async checkAliases(aliasesArr) {
        return new Promise(async res => {
           let count = 0;
           for (let alias of aliasesArr) {
               let res = await this.db.get(`SELECT * FROM aliases WHERE alias = '${alias}'`);
               if (res) count++;
           }
           if (count > 0) res(true);
           res(false);
        })
    }

    getCommand(alias) {
        this.db.get(`SELECT * FROM commands WHERE id IN (SELECT command_id FROM aliases WHERE alias = '${alias}')`,(err,row) => {
            if (err) throw err;
            return row;
        });
    }

    async truncateTables() {
        await this.db.run(`DROP TABLE commands`);
        await this.db.run(`DROP TABLE aliases`);
    }
}

module.exports = Database;