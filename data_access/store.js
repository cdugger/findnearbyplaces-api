const bcrypt = require("bcrypt");
const { Pool } = require("pg");
require("dotenv").config();
const { updateHelper } = require("../util/store");

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
    },

    addPlace: (name, category_id, latitude, longitude, description) => {
        const query = `insert into findnearbyplaces.place (name, latitude, longitude, description, category_id, customer_id
             values ($1, $2, $3, $4, $5) returning id`;
        return pool.query(query, [name, category_id, latitude, longitude, description])
            .then(x => {
                return { id: x.rows[0].id };
            });
    },

    addCategory: (name) => {
        return pool.query('insert into findnearbyplaces.category (name) values ($1) returning id', [name])
            .then(x => {
                return { id: x.rows[0].id };
            })
    },

    addPhoto: (photo) => {
        return pool.query('insert into findnearbyplaces.photo (file) values($1) returning id', [photo])
            .then(x => {
                return { id: x.rows[0].id };
            })
    },

    addPhotoToPlace: (photo, place_id) => {
        return addPhoto(photo)
            .then(x => {
                const photo_id = x.id;
                return pool.query('insert into findnearbyplaces.place_photo (location_id, photo_id) values ($1, $2)', [place_id, photo_id])
                    .then(y => {
                        return { id: photo_id };
                    });
            }).catch(err => {
                return { valid: false, message: "Invalid photo." };
            })
    },

    addPhotoToReview: (photo, review_id) => {
        return addPhoto(photo)
            .then(x => {
                const photo_id = x.id;
                return pool.query('insert into findnearbyplaces.review_photo (review_id, photo_id) values ($1, $2)', [review_id, photo_id])
                    .then(y => {
                        return { id: photo_id };
                    });
            }).catch(err => {
                return { valid: false, message: "Invalid photo." };
            });
    },

    addReview: (place_id, comment, rating) => {
        return pool.query('insert into findnearbyplaces.review (location_id, text, rating) values ($1, $2, $3)', [place_id, comment, rating]);
    },

    updatePlace: (place_id, name, category_id, latitude, longitude, description) => {
        const updateQuery = updateHelper('findnearbyplaces.place', place_id, { name, category_id, latitude, longitude, description });
        console.log(updateQuery);
        return pool.query(updateQuery.query, updateQuery.values)
            .then(x => {

            })
    },

    updatePhoto: (photo_id, photo) => {
        return pool.query('update findnearbyplaces.photo set photo = $1 where id = $2', [photo, photo_id]);
    },

    deletePlace: (place_id) => {
        return pool.query('delete from findnearbyplaces.place where id = $1', [place_id]);
    },

    deleteReview: (review_id) => {
        return pool.query('delete from findnearbyplaces.review where id = $1', [review_id]);
    },

    deletePhoto: (photo_id) => {
        return pool.query('detete from findnearbyplaces.photo where id = $1', [photo_id])
    }
};

module.exports = { store };
