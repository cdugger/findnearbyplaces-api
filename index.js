const express = require("express");
const cors = require('cors');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { MIN_EMAIL_LEN, MIN_PASS_LEN } = require("./util/constraints");

const { store } = require("./data_access/store");

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());
passport.use(new LocalStrategy({ usernameField: 'email' }, function verify(username, password, cb) {
    store.login(username, password)
        .then(x => {
            if (x.valid) {
                return cb(null, x.user);
            } else {
                return cb(null, false, { message: 'Incorrect username or password.' });
            }
        })
        .catch(err => {
            console.log(err);
            cb('Something went wrong');
        });
}));

app.use((req, res, next) => {
    console.log(`request url: ${req.url}`);
    console.log(`request method: ${req.method}`);
    next();
});

app.use(session({
    secret: 'keyboard dog',
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({ db: 'sessions.db', dir: './sessions' })
}));

app.use(passport.authenticate('session'));

passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        cb(null, { id: user.id, username: user.username });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});

app.get("/search", (req, res) => {
    const search_term = req.query.search_term;
    const user_location = req.query.user_location;
    const radius_filter = Number(req.query.radius_filter);
    const maximum_results_to_return = Number(req.query.maximum_results_to_return);
    const category_filter = req.query.category_filter;
    const sort = Number(req.query.sort);

    store.search(search_term, user_location, radius_filter, maximum_results_to_return, category_filter, sort)
        .then((x) => {
            if (x.valid) {
                res.json({ done: true, result: x.result });
            } else {
                res.status(404).json({ done: false, message: "0 search results." });
            }
        })
        .catch((err) => {
            console.log(err);
            res.status(500).json({ done: false });
        });
});

app.post("/customer", (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    if ((email && email.length <= MIN_EMAIL_LEN) || !email) {
        return res.status(400).json({ done: false, message: `Email must be greater than ${MIN_EMAIL_LEN} characters.` });
    }
    if ((password && password.length < MIN_PASS_LEN) || !password) {
        return res.status(400).json({ done: false, message: `Password must be greater than ${MIN_PASS_LEN} characters.` })
    } else {
        store.addCustomer(email, password)
            .then(x => {
                res.json({ done: true, message: "Customer added." });
            }).catch(err => {
                console.log(err);
                res.status(500).json({ done: false, message: "The customer was not added due to an error." });
            });
    }
});

app.post("/login", passport.authenticate('local', {
    successRedirect: '/login/succeeded',
    failureRedirect: '/login/failed'
}));

app.get('/login/succeeded', (req, res) => {
    res.status(200).json({ done: true, message: 'The customer logged in successfully.' });
});

app.get('/login/failed', (req, res) => {
    res.status(500).json({ done: false, message: 'The credentials are invalid.' });
})

app.post("/place", (req, res) => {
    if (!req.isAuthenticated()) {
        res.status(401).json({ done: false, message: 'Please log in first.' });
    }
    const name = req.body.name;
    const category_id = req.body.category_id;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const description = req.body.description;
    const customer_id = req.user.id;

    store.addPlace(name, category_id, latitude, longitude, description, customer_id)
        .then(x => {
            res.json({ done: true, id: x.id, message: "Place added." });
        }).catch(err => {
            console.log(err);
            res.status(500).json({ done: false, message: "The place was not added due to an error." })
        });
});

app.post("/category", (req, res) => {
    const name = req.body.name;

    store.addCategory(name)
        .then(x => {
            res.json({ done: true, id: x.id, message: "Category added." });
        }).catch(err => {
            console.log(err);
            res.status(500).json({ done: false, message: "The category was not added due to an error." })
        })
});

// If the photo is going to be added to the place, the review_id will be null.
// If the photo is going to be added to a review the place_id will be null.
app.post("/photo", (req, res) => {
    const photo = req.body.photo;
    const place_id = req.body.place_id;
    const review_id = req.body.review_id;

    if (review_id && place_id) {
        return { done: false, message: "Use either review_id or place_id, not both." }
    } else if (review_id) {
        store.addPhotoToReview(photo, review_id)
            .then(x => {
                res.json({ done: true, id: x.id, message: "Review photo added." });
            }).catch(err => {
                console.log(err);
                res.status(500).json({ done: false, message: "Review photo was not added due to an error." });
            });
    } else {
        store.addPhotoToPlace(photo, place_id)
            .then(x => {
                res.json({ done: true, id: x.id, message: "Place photo added." });
            }).catch(err => {
                console.log(err);
                res.status(500).json({ done: false, message: "Place photo was not added due to an error." });
            });
    }
});

app.post("/review", (req, res) => {
    if (!req.isAuthenticated()) {
        res.status(401).json({ done: false, message: 'Please log in first.' });
    }
    const place_id = req.body.place_id;
    const comment = req.body.comment;
    const rating = req.body.rating;
    const customer_id = req.user.id;

    if (rating < 0 || rating > 10) {
        res.status(400).json({ done: false, message: "Review rating must be between 1 and 10" });
    }

    store.addReview(place_id, comment, rating, customer_id)
        .then(x => {
            res.json({ done: true, id: x.id, message: "Review added." });
        }).catch(err => {
            console.log(err);
            res.status(500).json({ done: false, message: "Review was not added due to an error." });
        });
});

app.put("/place", (req, res) => {
    if (!req.isAuthenticated()) {
        res.status(401).json({ done: false, message: 'Please log in first.' });
    }
    const place_id = req.body.place_id;
    const name = req.body.name;
    const category_id = req.body.category_id;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const description = req.body.description;

    store.updatePlace(place_id, name, category_id, latitude, longitude, description)
        .then(x => {
            res.json({ done: true, message: "Place successfully updated." });
        }).catch(err => {
            console.log(err);
            res.status(500).json({ done: false, message: "Something went wrong." })
        })
});

app.put("/review", (req, res) => {
    if (!req.isAuthenticated()) {
        res.status(401).json({ done: false, message: 'Please log in first.' });
    }
    const review_id = req.body.review_id;
    const comment = req.body.comment;
    const rating = req.body.rating;

    store.updateReview(review_id, comment, rating)
        .then(x => {
            res.json({ done: true, message: "Review successfully updated." });
        }).catch(err => {
            console.log(err);
            res.status(500).json({ done: false, message: "Something went wrong." });
        })
});

app.put("/photo", (req, res) => {
    const photo_id = req.body.photo_id;
    const photo = req.body.photo;
    store.updatePhoto(photo_id, photo)
        .then(x => {
            res.json({ done: true, message: "Photo successfully updated. " });
        }).catch(err => {
            console.log(err);
            res.status(500).json({ done: false, message: "Photo was not updated due to an error." });
        });
})

app.delete("/place", (req, res) => {
    if (!req.isAuthenticated()) {
        res.status(401).json({ done: false, message: 'Please log in first.' });
    }
    const place_id = req.body.place_id;

    store.deletePlace(place_id)
        .then(x => {
            res.json({ done: true, message: "Place successfully deleted." });
        }).catch(err => {
            console.log(err);
            res.status(500).json({ done: false, message: "Place was not deleted due to an error." });
        });
});

app.delete("/review", (req, res) => {
    if (!req.isAuthenticated()) {
        res.status(401).json({ done: false, message: 'Please log in first.' });
    }
    const review_id = req.body.review_id;

    store.deleteReview(review_id)
        .then(x => {
            res.json({ done: true, message: "Review successfully deleted." });
        }).catch(err => {
            console.log(err);
            res.status(500).json({ done: false, message: "Review was not deleted due to an error." });
        })
});

app.delete("/photo", (req, res) => {
    const photo_id = req.body.photo_id;

    store.deletePhoto(photo_id)
        .then(x => {
            res.json({ done: true, message: "Photo successfully deleted." });
        }).catch(err => {
            console.log(err);
            res.status(500).json({ done: false, message: "Photo was not deleted due to an error." });
        })
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});