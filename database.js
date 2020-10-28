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

    async getCommand(alias) {
        let row = await this.db.get(`SELECT * FROM commands WHERE id IN (SELECT command_id FROM aliases WHERE alias = '${alias}')`);
        if (row) return row;
        return false;
    }

    async deleteCommand(alias){
        if (await this.checkAliases(alias)) return false;
        let command_id = await this.db.get(`SELECT command_id FROM aliases WHERE alias = '${alias}'`);
        if (!command_id) {
            return false;
        } else {
            await this.db.run(`DELETE FROM aliases WHERE command_id = ${command_id.command_id}`);
            await this.db.run(`DELETE FROM commands WHERE id = ${command_id.command_id}`);
            return true;
        }
    }

    async editCommand(alias,newAnswer) {
        let command = await this.getCommand(alias);
        if (!command) return false;
        await this.db.run(`UPDATE commands SET answer = '${newAnswer}' WHERE id = ${command.id}`);
        return await this.getCommand(alias);
    }

    async addAlias(alias,newAlias) {
        let command = await this.getCommand(alias);
        if (!command) return false;
        await this.db.run(`INSERT INTO aliases (alias,command_id) VALUES ('${newAlias}','${command.id}')`);
        return true;
    }

    async deleteAlias(alias) {
        await this.db.run(`DELETE FROM aliases WHERE alias = ${alias}`);
        return true;
    }

    async truncateTables() {
        await this.db.run(`DROP TABLE commands`);
        await this.db.run(`DROP TABLE aliases`);
    }
}

module.exports = Database;