const { Pool } = require('pg')
const bcrypt = require('bcrypt'); 

class UserRepository{

    constructor() {
        this.conn = new Pool({
            host: 'localhost',
            database: 'users',
            user: 'snake',
            password: 'jdpoej03jg0-3p4tj',
            port: 5432
        });
    }

    async isLoginCorrect(username, password) {
        if ( !username || !password ) return false;

        try {
            const res = await this.conn.query(
                'SELECT "password" FROM "users" WHERE "username" = $1',
                [username]
            );

            if (res.rows.length === 0) return false;
            
            return await bcrypt.compare(password, res.rows[0].password);
        } catch(err) {
            console.error(err);
            return false;
        }
    }

    async usernameExists(username){
        if ( !username ) return true;

        try {
            const res = await this.conn.query(
                'SELECT "username" FROM "users" WHERE "username" = $1',
                [username]
            );
            return res.rows.length !== 0;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async insertNewLoginData(username, password) {
        if ( !username || !password ) return;

        try {
            const hash = await bcrypt.hash(password, 10);

            await this.conn.query(
                'INSERT INTO "users" ("username", "password") VALUES ($1, $2)',
                [username, hash]
            );
            return true;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async updatePassword(username, password) {
        if ( !username || !password ) return;

        try{
            const hash = await bcrypt.hash(password, 10);

            await this.conn.query(
                'UPDATE "users" SET "password" = ($1) WHERE "username" = $2',
                [hash, username]
            );
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async deleteAccount(username, password) {
        if (!username || !(await this.usernameExists(username))) 
            return { success: false, cause: 'username does not exist' };

        if(!(await this.isLoginCorrect(username, password)))
            return { success: false, cause: 'incorrect password' };

        try{
            await this.conn.query(
                'DELETE FROM "users" WHERE "username" = $1',
                [username]
            )
        } catch (err){
            console.error(err);
            throw err;
        }

        return { success: true };
    }
}

module.exports = { UserRepository };