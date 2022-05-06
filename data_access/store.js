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
        const query = `select lower(p.name) as placename, latitude, longitude, lower(c.name) as categoryname, p.id, p.description, ph.file
         from findnearbyplaces.place p 
         join findnearbyplaces.category c on p.category_id = c.id
         join findnearbyplaces.place_photo pp on pp.location_id = p.id
         join findnearbyplaces.photo ph on pp.photo_id = ph.id`;
        console.log(query)
        return pool.query(query)
            .then((x) => {
                console.log(x.rows);
                if (x.rows.length > 0) {
                    let categoryMatch = false;
                    let searchTermMatch = false;
                    let result = [];
                    for (let row of x.rows) {
                        if (radius_filter) {
                            console.log('Using radius filter!');
                            // distance is in meters
                            const distance = calcCrow(user_latitude, user_longitude, row.latitude, row.longitude);
                            console.log(distance)
                            if (distance >= radius_filter) {
                                // ignore this place if it isn't in range of the user
                                continue;
                            }
                        }

                        if (category_filter) {
                            console.log('Using category filter!')
                            if (row.categoryname.indexOf(category_filter.toLowerCase()) !== -1) {
                                categoryMatch = true;
                            }
                        }
                        console.log(row.placename + " " + row.categoryname);
                        if (row.placename.indexOf(search_term.toLowerCase()) !== -1 || row.categoryname.indexOf(search_term.toLowerCase()) !== -1) {
                            console.log('Search term found!');
                            searchTermMatch = true;
                        }

                        if (categoryMatch || searchTermMatch) {
                            if (result.length >= maximum_results_to_return) {
                                console.log('Maximum length reached!')
                                break;
                            }
                            result.push({
                                name: row.placename,
                                address: row.latitude + "," + row.longitude,
                                category: row.categoryname,
                                description: row.description,
                                // TODO calculate rating
                                rating: 10,
                                thumbnail: row.file,
                                id: row.id
                            });
                        } else {
                            console.log('NO MATCH!');
                        }

                    }
                    console.log(result)
                    return { valid: true, result: result };
                } else {
                    return { valid: false };
                }
            });
    },

    getPlace: (place_id) => {
        const queryStr = `select pl.customer_id, pl.name, pl.latitude, pl.longitude, pl.description, c.name as category_name, ph.file from findnearbyplaces.place pl
         join findnearbyplaces.place_photo pp on pp.location_id = pl.id
         join findnearbyplaces.photo ph on pp.photo_id = ph.id
         join findnearbyplaces.category c on pl.category_id = c.id
         where pl.id = $1`;
        return pool.query(queryStr, [place_id])
            .then(x => {
                console.log(x.rows);
                if (x.rows.length > 0) {
                    return { valid: true, result: x.rows[0] }
                } else {
                    return { valid: false };
                }
            })
    },

    getPlacePhoto: (place_id) => {
        const queryStr = `select p.file from findnearbyplaces.place_photo pp join findnearbyplaces.photo p on pp.photo_id = p.id
                            where pp.location_id = $1`;
        return pool.query(queryStr, [place_id])
            .then(x => {
                if (x.rows.length > 0) {
                    return { valid: true, result: x.rows[0] }
                } else {
                    return { valid: false };
                }
            })
    },

    getReviews: (place_id) => {
        return pool.query('select r.text, r.rating, c.email from findnearbyplaces.review r join findnearbyplaces.customer c on r.customer_id = c.id where location_id = $1', [place_id])
            .then(x => {
                return x.rows;
            })
    },

    getCategories: () => {
        return pool.query('select name, id from findnearbyplaces.category')
            .then(x => {
                if (x.rows.length > 0) {
                    return x.rows.map(category => {
                        return { id: category.id, name: category.name };
                    })
                }
            })
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

    addPlace: (name, category_id, latitude, longitude, description, customer_id) => {
        const query = `insert into findnearbyplaces.place (name, latitude, longitude, description, category_id, customer_id)
             values ($1, $2, $3, $4, $5, $6) returning id`;
        console.log(query);
        return pool.query(query, [name, latitude, longitude, description, category_id, customer_id])
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
        let cb = x => {
            const photo_id = x.rows[0].id;
            console.log(`The photo id is ${photo_id}`);
            return pool.query('insert into findnearbyplaces.place_photo (location_id, photo_id) values ($1, $2)', [place_id, photo_id])
                .then(y => {
                    return { id: photo_id };
                });
        };

        if (!photo) {
            return pool.query('insert into findnearbyplaces.photo (file) values (default) returning id')
                .then(cb);
        } else {
            return pool.query('insert into findnearbyplaces.photo (file) values ($1) returning id', [photo])
                .then(cb);
        }
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

    addReview: (place_id, comment, rating, customer_id) => {
        return pool.query('insert into findnearbyplaces.review (location_id, text, rating, customer_id) values ($1, $2, $3, $4) returning id', [place_id, comment, rating, customer_id])
            .then(x => {
                const review_id = x.rows[0].id;
                return { id: review_id };
            })
    },

    updatePlace: (place_id, name, category_id, latitude, longitude, description) => {
        const updateQuery = updateHelper('findnearbyplaces.place', place_id, { name, category_id, latitude, longitude, description });
        console.log(updateQuery);
        return pool.query(updateQuery.query, updateQuery.values);
    },

    updateReview: (review_id, text, rating) => {
        const updateQuery = updateHelper('findnearbyplaces.review', review_id, { text, rating });
        console.log(updateQuery);
        return pool.query(updateQuery.query, updateQuery.values);
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
