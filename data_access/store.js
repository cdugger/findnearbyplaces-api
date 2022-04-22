const bcrypt = require("bcrypt");
const { Pool } = require("pg");
require("dotenv").config();

const connectionString = `postgres://${process.env.DBUSERNAME}:${process.env.PASSWORD}@${process.env.HOST}:${process.env.DATABASEPORT}/${process.env.DATABASE}`;
const connection = {
    connectionString: process.env.DATABASE_URL ? process.env.DATABASE_URL : connectionString,
    ssl: { rejectUnauthorized: false },
};
const pool = new Pool(connection);

let store = {
    search: (search_term, user_location, radius_filter, maximum_results_to_return, category_filter, sort) => {
        return pool.query('select * from findnearbyplaces.place')
            .then((x) => {
                if (x.rows.length > 0) {
                    let result = [];
                    for (let row of x.rows) {
                        result.push({
                            bussiness_name: row.name,
                            address: row.latitude + "," + row.longitude,
                            category: row.category,
                            // NOTE: calculating the rating from reviews for every query could be expensive
                            rating: row.rating,
                            thumbnail: row.thumbnail,
                        });
                    }
                    return { valid: true, result: result };
                } else {
                    return { valid: false };
                }
            });
    },

    addCustomer: (email, password) => {
        const hash = bcrypt.hashSync(password, 10);
        return pool.query('insert into findnearbyplaces.customer (email, password) values ($1, $2)', [email, hash]);
    }
};

module.exports = { store };
