const bcrypt = require("bcrypt");
const { Pool } = require("pg");
require("dotenv").config();
const { updateHelper, calcCrow } = require("../util/store");

const connectionString = `postgres://${process.env.DBUSERNAME}:${process.env.PASSWORD}@${process.env.HOST}:${process.env.DATABASEPORT}/${process.env.DATABASE}`;
const connection = {
    connectionString: process.env.DATABASE_URL ? process.env.DATABASE_URL : connectionString,
    ssl: { rejectUnauthorized: false },
};
const pool = new Pool(connection);

let store = {
    // A search term is a place name or a category name or part of a place name or part of a category name.
    search: (search_term, user_location, radius_filter, maximum_results_to_return, category_filter, sort) => {
        const user_coords = user_location.split(',');
        if (user_coords.length !== 2) {
            return { valid: false };
        }
        const user_latitude = Number(user_coords[0]);
        const user_longitude = Number(user_coords[1]);
        if (radius_filter) {
            // query to calculate the distance between each place and see if it's <= the radius filter
        }
        const query = `select lower(p.name) as placename, latitude, longitude, lower(c.name), p.rating as categoryname from findnearbyplaces.place p 
            join findnearbyplaces.category c on p.category_id = c.id
            join findnearby_places.place_photo pp on pp_
            `;
        return pool.query(query)
            .then((x) => {
                if (x.rows.length > 0) {
                    let categoryMatch = false;
                    let searchTermMatch = false;
                    let result = [];
                    for (let row of x.rows) {
                        if (radius_filter) {
                            // distance is in meters
                            const distance = calcCrow(user_latitude, user_longitude, row.latitude, row.longitude) * 1000.0;
                            if (distance >= radius_filter) {
                                // ignore this place if it isn't in range of the user
                                continue;
                            }
                        }

                        if (category_filter) {
                            if (row.categoryname.indexOf(category_filter) !== -1) {
                                categoryMatch = true;
                            }
                        }
                        if (row.placename.indexOf(search_term) !== -1 || row.categoryname.indexOf(search_term) !== -1) {
                            searchTermMatch = true;
                        }

                        if (categoryMatch || searchTermMatch) {
                            if (result.length >= result.length) {
                                break;
                            }
                            result.push({
                                bussiness_name: row.placename,
                                address: row.latitude + "," + row.longitude,
                                category: row.categoryname,
                                rating: row.rating,
                                thumbnail: row.thumbnail,
                            });
                        }

                    }
                    return { valid: true, result: result };
                } else {
                    return { valid: false };
                }
            });
    },

    login: (email, password) => {
        return pool.query('select id, email, password from findnearbyplaces.customer where email = $1', [email])
            .then(x => {
                if (x.rows.length == 1) {
                    let valid = bcrypt.compareSync(password, x.rows[0].password);
                    if (valid) {
                        return { valid: true, user: { id: x.rows[0].id, username: x.rows[0].email } };
                    } else {
                        return { valid: false, message: 'Credentials are not valid.' };
                    }
                } else {
                    return { valid: false, message: 'Email not found.' };
                }
            });
    },

    addCustomer: (email, password) => {
        const hash = bcrypt.hashSync(password, 10);
        return pool.query('insert into findnearbyplaces.customer (email, password) values ($1, $2)', [email, hash]);
    },

    addPlace: (name, category_id, latitude, longitude, description) => {
        const query = `insert into findnearbyplaces.place (name, latitude, longitude, description, category_id)
             values ($1, $2, $3, $4, $5) returning id`;
        console.log(query);
        return pool.query(query, [name, latitude, longitude, description, category_id])
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

    addPhotoToPlace: (photo, place_id) => {
        return pool.query('insert into findnearbyplaces.photo (file) values ($1) returning id', [photo])
            .then(x => {
                const photo_id = x.rows[0].id;
                console.log(`The photo id is ${photo_id}`);
                return pool.query('insert into findnearbyplaces.place_photo (location_id, photo_id) values ($1, $2)', [place_id, photo_id])
                    .then(y => {
                        return { id: photo_id };
                    });
            });
    },



    addPhotoToReview: (photo, review_id) => {
        return pool.query('insert into findnearbyplaces.photo (file) values ($1) returning id', [photo])
            .then(x => {
                const photo_id = x.rows[0].id;
                return pool.query('insert into findnearbyplaces.review_photo (review_id, photo_id) values ($1, $2)', [review_id, photo_id])
                    .then(y => {
                        return { id: photo_id };
                    });
            })
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
