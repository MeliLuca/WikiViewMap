const colors = require("colors");
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors')
const axios = require('axios');
const MongoClient = require('mongodb').MongoClient;
// con mongoose utilizzo solo la parte di autenticazione dell'admin per accedere
// alla pagina che permette di modificare il database. 
// per tutte le altre interazioni con il DB utilizzo le 
// funzioni di MongoDB
const mongoose = require('mongoose');
const assert = require('assert');
const app = express();
const bodyparser = require("body-parser"); // body-parser middleware is used to parse the request body and
// directly provide a Javascript object if the "Content-type" is
// application/json
const passport = require("passport"); // authentication middleware for express
const passportHTTP = require("passport-http"); // implements Basic and Digest authentication for HTTP (used for /login endpoint)
const jsonwebtoken = require("jsonwebtoken"); // JWT generation
const jwt = require("express-jwt"); // JWT parsing middleware for express
const user = require("./User");

const result = require('dotenv').config(); // The dotenv module will load a file named ".env"
// file and load all the key-value pairs into
// process.env (environment variable)
if (result.error) {
    console.log("Unable to load \".env\" file. Please provide one to store the JWT secret key");
    process.exit(-1);
}
if (!process.env.JWT_SECRET) {
    console.log("\".env\" file loaded but JWT_SECRET=<secret> key-value pair was not found");
    process.exit(-1);
}

colors.enabled = true;

// VARIABILI DI DEBUG
var count_views = 0;
var count_insert_data = 0;

// configuarazione del DB
const DB_NAME = 'wiki_view_db';
const HOST_NAME = 'mongodb://localhost:27017';
const PORT_NUM = 8080;

// VARIABILI COSTANTI
/*
* stringa contenente il pezzo di url da utilizzare per la chiamata coordinates.
* la parte restante è da completare con parametri BOX se ricerca effettuata tramite boundig box
* PAGETITLE se la ricerca viene effettuata tramite titolo della pagina
*/
const URL_COORDINATES = '.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates&list=geosearch&indexpageids=1';
// stringa contenente la parte di url per le chiamate alle API langlinks
const URL_LANGLINKS = '.wikipedia.org/w/api.php?action=query&format=json&prop=langlinks';
// stringa contenete la parte di url per le chiamate alle API pageviews
const URL_PAGEVIEWS = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/';
// limiti di chiamate per le API di wikipedia
const GS_LIMIT = 'max';
const LANG_LIMIT = 'max';
// massimo numero di chiamate al secondo per API di wikipedia Langlinks
const RATE_LANGS_LIMIT = 50;
// tempo da aspettare prima di effettuare le altre chiamate alle API langlinks
const TIME_WAIT_LANGS = 1500;
// massimo numero di chiamate al secondo per API Pageviews
const RATE_VIEWS_LIMIT = 50;
// tempo da aspettare prima di effettuare le altre chiamate alle API pageviews
const TIME_WAIT_VIEWS = 1500;
// massimo numero di elementi da inserire contemporaneamente
const MAX_BATCH_DIM = 300;

app.use(cors('*'));
app.use(function (err, req, res, next) {
    console.log("Request error: ".red + JSON.stringify(err));
    res.status(err.statusCode || 500).json(err);
});

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header("Access-Control-Allow-Headers", "Origin, Accept,Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
    next();
});
app.use(bodyparser.json({ limit: '500mb' }));
app.use(bodyparser.urlencoded({ limit: '500mb', extended: true }));


// Create a new MongoClient
//const client = new MongoClient(HOST_NAME, { useNewUrlParser: true, useUnifiedTopology: true });
var db;
// Use connect method to connect to the Server
mongoose.connect(HOST_NAME + '/' + DB_NAME, { useNewUrlParser: true }).then(function onconnected() {

    db = mongoose.connection.db;
    console.log("Connected successfully to server");
    /* var u = user.newUser({
        username: "admin",
        mail: "admin@mail.it"
    });
    console.log('untente nuovo')
    u.setAdmin();
    u.setModerator();
    u.setPassword("admin");
    console.log('ho settato tutto')

    u.save().then(() => {console.log('admin creato'.green)}).catch(err =>{
        console.log(err)
        console.log('errore'.red)
    }) */
    // https server
    /* var server = https.createServer({
      key: fs.readFileSync('keys/key.pem'),
      cert: fs.readFileSync('keys/cert.pem')
    }, app);  */
    // http server
    var server = http.createServer(app);
    server.listen(PORT_NUM, function () { return console.log(("HTTP Server started on port " + PORT_NUM).green); });
});

var auth = jwt({ secret: process.env.JWT_SECRET });

passport.use(new passportHTTP.BasicStrategy(
    function (username, password, done) {

        // Delegate function we provide to passport middleware
        // to verify user credentials 
        //console.log("New login attempt from ".green + username );
        console.log('username ' + username)
        user.getModel().findOne({ mail: username }, (err, user) => {
            console.log(user)
            if (err) {
                console.log('errore di qualcosa')
                return done({ statusCode: 500, error: true, errormessage: err });
            }
            if (!user) {
                console.log('errore non user')
                return done({ statusCode: 500, error: true, errormessage: "Invalid user" });
            }
            if (user.validatePassword(password)) {
                console.log('validate password')
                return done(null, user);
            }
            console.log('errore altro strano')
            return done({ statusCode: 500, error: true, errormessage: "Invalid password" });
        })
    }
));

app.get("/login", passport.authenticate('basic', { session: false }), (req, res, next) => {
    console.log('arrivato login')
    // If we reach this point, the user is successfully authenticated and
    // has been injected into req.user

    // We now generate a JWT with the useful user data
    // and return it as response

    var tokendata = {
        username: req.user.username,
        mail: req.user.mail,
        roles: req.user.roles,
        id: req.user.id
    };

    console.log("Login granted. Generating token");
    var token_signed = jsonwebtoken.sign(tokendata, process.env.JWT_SECRET, { expiresIn: '1d' });
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Note: You can manually check the JWT content at https://jwt.io
    /* res.header('Access - Control - Allow - Credentials: true')
    res.header('Access - Control - Allow - Headers: Origin, Authorization') */
    return res.status(200).jsonp({ error: false, errormessage: "", token: token_signed, expired: tomorrow.getTime() });

});

app.post('/users', auth, (req, res, next) => {
    // Check admin role
    if (!user.newUser(req.user).hasAdminRole()) {
        return next({ statusCode: 404, error: true, errormessage: "Unauthorized: user is not an admininstrator" });
    }
    var u = user.newUser(req.body);
    if (!req.body.password) {
        return next({ statusCode: 404, error: true, errormessage: "Password field missing" });
    }
    u.setPassword(req.body.password);
    u.setAdmin();
    u.save().then((data) => {
        return res.status(200).json({ error: false, errormessage: "", id: data._id });
    }).catch((reason) => {
        return next({ statusCode: 404, error: true, errormessage: "DB error: " + reason });
    });
});


function date_parse(data) {
    let y = data.slice(0, 4);
    let m = data.slice(4, 6);
    let d = data.slice(6, 8);
    let newDate = new Date(y + '-' + m + '-' + d + 'T00:00:00Z');
    return newDate;
};

async function find_bbox(latlng, lang) {

    return new Promise((resolve, reject) => {
        let bbox = latlng[0].lat + '|' + latlng[0].lng + '|' + latlng[1].lat + '|' + latlng[1].lng;
        //var marker = L.marker([((latlng[0].lat + latlng[1].lat) / 2), ((latlng[0].lng + latlng[1].lng) / 2)]).addTo(mymap)
        axios.get('https://' + lang + URL_COORDINATES + '&gsbbox=' + bbox + '&gsradius=10000&gslimit=' + GS_LIMIT)
            .then(async (response) => {
                //console.log(data.query)
                if (response.data.error || response.data.query.geosearch.length == 500) {
                    let bbox_array = [];
                    let total_points = [];
                    // tassello il BBOX in piu parti
                    let halfPoint = { lat: (latlng[0].lat + latlng[1].lat) / 2, lng: (latlng[0].lng + latlng[1].lng) / 2 }
                    let leftBox = [{ lat: halfPoint.lat, lng: latlng[0].lng }, { lat: latlng[1].lat, lng: halfPoint.lng }]
                    let rightBox = [{ lat: latlng[0].lat, lng: halfPoint.lng }, { lat: halfPoint.lat, lng: latlng[1].lng }]

                    bbox_array.push([latlng[0], halfPoint], [halfPoint, latlng[1]], rightBox, leftBox);
                    // questa funzione mi permette di eseguire le funzioni e aspettare di ricevere i loro punti trovati
                    async function process_bbox(bbox_array) {
                        for (let new_latlng of bbox_array) {
                            await find_bbox(new_latlng, lang).then(nuovi => {
                                total_points = total_points.concat(nuovi)
                            })
                        }
                        return total_points;
                    }
                    resolve(process_bbox(bbox_array))
                } else {
                    resolve(response.data.query.geosearch);
                }
            }).catch(err => {
                console.log(err);
                reject(err)
            })
    })
}

function get_points(research_city, research_lang, research_bbox) {
    console.log('cerco')
    return new Promise((resolve, reject) => {
        if (research_bbox == 'null') {
            console.log('cerco points by city')
            axios.get('https://' + research_lang + URL_COORDINATES + '&gspage=' + research_city + '&gsradius=10000&gslimit=' + GS_LIMIT)
                .then(response => resolve(response.data.query.geosearch))
        }
        else {
            find_bbox(research_bbox, research_lang)
                .then(response => {
                    console.log('finito bbox')
                    resolve(response)
                })
                .catch(err => reject(err))
        }
    })
}

function get_pages(points, init, end) {
    return new Promise((resolve, reject) => {
        let promList = [];
        for (let i = init; i < points.length && i < end; i++) {
            let curr_point = points[i];
            if (curr_point == undefined) console.log('qualcosa è undefined'.bgRed)
            let id = curr_point.pageid;
            let pref = curr_point.lang;
            promList.push(
                axios.get('https://' + pref + URL_LANGLINKS + '&pageids=' + id + '&llimit=' + LANG_LIMIT)
                    .then(response => {
                        let result = response.data.query.pages[id].langlinks;
                        let accumulator_page = [curr_point];
                        if (result !== undefined) {
                            for (let j = 0; j < result.length; j++) {
                                let obj = result[j]
                                // non inserisco il pageid
                                accumulator_page.push(
                                    {
                                        lang: obj['lang'],
                                        title: obj['*'],
                                        lat: curr_point.lat,
                                        lon: curr_point.lon,
                                        pageviews: []
                                    }
                                );
                            }
                        }
                        // metto tutte le pagine dentro un array in modo da usare la funzione flat per avere un unico array con tutte le lingue
                        points[i] = accumulator_page;
                    })
                    .catch(err => reject(err))
            );
        }
        Promise.all(promList).then(function () {
            if (init < points.length) {
                let time = setTimeout(function () {
                    resolve(get_pages(points, init + RATE_LANGS_LIMIT, end + RATE_LANGS_LIMIT))
                }, TIME_WAIT_LANGS)
            }
            else resolve(points)
        });
    })
}


// funzione senza somme pre-aggregate
function get_views(pages, init, end) {
    return new Promise(async (resolve, reject) => {
        // N.B gli elementi dell'array sono {lang , title}
        let current_date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        let promList = [];
        for (let i = init; i < pages.length && i < end; i++) {
            let curr_page = pages[i];
            if (curr_page == undefined) {
                console.log('undefined ' + curr_page);
                console.log(pages.slice(i));
            }
            promList.push(
                axios.get(URL_PAGEVIEWS + curr_page.lang + '.wikipedia.org/all-access/user/' + curr_page.title + '/daily/20150501/' + current_date)
                    .then((response) => {
                        // incremento contatore per debug
                        let items = response.data.items;
                        count_views += items.length;
                        for (let j = 0; j < items.length; j++) {
                            curr_views = items[j].views;
                            curr_timestamp = date_parse(items[j].timestamp);
                            curr_page.pageviews.push({ timestamp: curr_timestamp, views: curr_views });
                        }

                    }).catch(err => {
                        if (err.response != undefined && err.response.status != 404) reject(err.response.status)
                        //countdate++;
                    })
            );
        }
        Promise.all(promList);
        if (init < pages.length) {
            let time = setTimeout(function () {
                resolve(get_views(pages, init + RATE_VIEWS_LIMIT, end + RATE_VIEWS_LIMIT));
            }, TIME_WAIT_VIEWS);
        }
        else resolve(pages)
    })
}

function insert_points(research_city, research_lang, points) {
    return new Promise(async (resolve, reject) => {
        let insert_list = [];
        for (let i = 0; i < points.length; i++) {
            let pnt = points[i];
            let main_lang = pnt.lang == research_lang ? true : false;
            let initial_date = pnt.pageviews[0] == undefined ? null : pnt.pageviews[0].timestamp;
            let final_date = pnt.pageviews[pnt.pageviews.length - 1] == undefined ? null : pnt.pageviews[pnt.pageviews.length - 1].timestamp;
            insert_list.push(
                {
                    title: pnt.title,
                    lang: pnt.lang,
                    main_lang: main_lang,
                    coordinates: [pnt.lon, pnt.lat],
                    initial_date: initial_date,
                    final_date: final_date,
                    pageviews: pnt.pageviews
                }
            )
            count_insert_data++;

            if (insert_list.length >= MAX_BATCH_DIM || i >= points.length - 1) {
                console.log(('ne inserisco ' + insert_list.length).cyan)
                await db.collection(research_city).insertMany(insert_list)
                    .then(item => { console.log('fatto'.green) })
                    .catch(err => {
                        console.log((count_insert_data - points.length) + 'pagine mancanti'.red)
                        return reject(err);
                    })
                console.log((count_insert_data + ' / ' + points.length).blue)
                insert_list = [];
            }
        }
        db.collection(research_city).createIndex([{ "pageviews.timestamp": 1 }, { lang: 1 }, { main_lang: 1 }, { coordinates: "2d" }], function (err, result) {
            console.log('vaben')
        })
        return resolve('ok')
    })
}

// riservati agli admin

app.post('/newCity', auth, function (req, res) {
    //res.setHeader('contentType')
    let research_lang = req.query.lang;
    let research_city = req.query.city;
    let json_bbox = req.body.bbox;
    let research_bbox = json_bbox != undefined ? JSON.parse(json_bbox) : 'null';
    get_points(research_city, research_lang, research_bbox)
        .then(response => {
            let points = response.map(obj => {
                let pnt = {
                    pageid: obj.pageid,
                    title: obj.title,
                    lang: research_lang,
                    lat: obj.lat,
                    lon: obj.lon,
                    pageviews: []
                }
                return pnt
            });
            // variabile per settare una coordinata per il documento contenente le informazioni della città
            let pnt_save = {coord : {lat : points[0].lat, lon : points[0].lon}, tot_points: points.length};
            console.log(points.length)
            res.status(200).send('inseriti ' + points.length + ' punti di interesse');
            let init = 0;
            let end = RATE_LANGS_LIMIT;
            get_pages(points, init, end)
                .then(data => {
                    // creo la funzione perchè .flat() non va per versioni di node < 11
                    function flatter(){
                        let ris=[];
                        for(let val of data){
                            for(let el of val){
                                ris.push(el)
                            }
                        }
                        return ris;
                    }
                    let pages = flatter()
                    console.log('cerco le views')
                    points = []; // serve per liberare memoria
                    init = 0;
                    end = RATE_VIEWS_LIMIT;
                    get_views(pages, init, end)
                        .then(points_views => {
                            pages = []; // libera la memoria
                            console.log(count_views + ' tot views'.blue)
                            insert_points(research_city, research_lang, points_views)
                                .then(async (ris) => {
                                    points_views = []; // libera la memoria
                                    await db.collection('info_city').insertOne({
                                        city: research_city,
                                        bbox: research_bbox,
                                        coordinates : pnt_save.coord,
                                        lang: research_lang,
                                        tot_pnt: pnt_save.tot_points,
                                        date: new Date().toUTCString,
                                    })
                                    console.log('Tutti i dati salvati'.bgGreen)
                                })
                                .catch(err => {
                                    console.log(err)
                                    console.log(err.message);
                                    console.log('errore scrittura sul DB'.bgRed)
                                })
                        })
                        .catch(err => {
                            console.log(err)
                            console.log(err.message)
                            console.log('errore chiamata views'.bgRed)
                        })
                })
                .catch(err => {
                    console.log(err)
                    console.log('errore chiamata langs'.bgRed)
                })
        })
        .catch(err => {
            console.log(err.toString());
            res.status(500).json({
                error: 'città non trovata',
            });
        })
})

app.get('/infodb', auth, function (req, res) {
    let info_coll = db.collection('info_city')
    info_coll.find({}).toArray((err,items)=>{
        res.send(items)
    })
})

app.get('/citiesList', function (req, res) {
    db.listCollections().toArray((err, items) => {
        let response = items.filter(x => { return x.name.slice(0, 4) != 'info' && x.name != 'users' }).map(x => { return x.name }).sort();
        res.send(response)
    })
})

app.get('/show', function (req, res) {
    let city = db.collection(req.query.city);
    //let date = date_parse(req.query.dataInizio)
    city.find({ lang: 'de' }).toArray(function (err, cities) {
        res.send(cities[0])
    })
    /* city.find({pageviews:{timestamp : date}}).toArray(function (err, documents) {
        console.log(documents.length)
        res.send(documents);
    }) */
})

function query_views(req) {
    return new Promise((resolve, reject) => {
        let collection = db.collection(req.query.city);
        let lang = req.query.lang;
        let dataInizio = date_parse(req.query.dataInizio);
        let dataFine = date_parse(req.query.dataFine);
        let bbox_recive = req.query.bbox;
        console.log(req.query.city + ' ' + dataInizio + ' ' + dataFine + ' ' + lang)
        if (bbox_recive) {
            console.log('cerco by box')
            let bbox = JSON.parse(bbox_recive)
            collection.find({
                lang: lang,
                // per il filtro tramite box bisogna mettere prima il punto basso a destra e dopo quello alto a sinistra
                coordinates: { $geoWithin: { $box: [[bbox[1].lng, bbox[0].lat], [bbox[0].lng, bbox[1].lat]] } }
            }).toArray((err, result) => {
                if (err) console.log(err)
                console.log('numero di pagine trovate ' + result.length);
                let id_list = result.map(x => { return x._id })
                collection.aggregate([
                    {
                        $match: { _id: { $in: id_list } },
                    },
                    {
                        $project: {
                            title: 1,
                            lon: { $arrayElemAt: ['$coordinates', 0] },
                            lat: { $arrayElemAt: ['$coordinates', 1] },
                            views: {
                                $reduce: {
                                    input: {
                                        // in questo modo si limitano gli stage della pipeline rendendo più veloce l'esecuzione della query
                                        $filter: {
                                            input: '$pageviews',
                                            as: 'page',
                                            cond: {
                                                $and: [
                                                    { $gte: ["$$page.timestamp", dataInizio] },
                                                    { $lte: ["$$page.timestamp", dataFine] },
                                                ]
                                            }
                                        }
                                    },
                                    initialValue: 0,
                                    in: {
                                        $sum: ['$$value', '$$this.views']
                                    }
                                }
                            },
                        }
                    },
                    {
                        $project: { _id: 0 }
                    },
                ], function (err, data) {
                    data.toArray((err, result) => {
                        console.log('numero di pagine da inviare ' + result.length)
                        if (!err) resolve(result)
                        else reject(err)
                    })
                })
            })
        } else {
            collection.aggregate([
                {
                    $match: { lang: lang }
                },
                {
                    $project: {
                        title: 1,
                        lon: { $arrayElemAt: ['$coordinates', 0] },
                        lat: { $arrayElemAt: ['$coordinates', 1] },
                        views: {
                            $reduce: {
                                input: {
                                    $filter: {
                                        input: '$pageviews',
                                        as: 'page',
                                        cond: {
                                            $and: [
                                                { $gte: ["$$page.timestamp", dataInizio] },
                                                { $lte: ["$$page.timestamp", dataFine] },
                                            ]
                                        }
                                    }
                                },
                                initialValue: 0,
                                in: {
                                    $sum: ['$$value', '$$this.views']
                                }
                            }
                        },
                    }
                },
                {
                    $project: { _id: 0 }
                }
                // tempo di esecuzione di 17,7 ai 22 secondi
                /* { $unwind: '$pageviews' },
                {
                    $match: { 'pageviews.timestamp': { $gte: dataInizio, $lte: dataFine } }
                }, */
                /* {
                    $group: {
                        _id: {
                            title: '$title',
                            lon: { $arrayElemAt: ['$coordinates', 0] },
                            lat: { $arrayElemAt: ['$coordinates', 1] }
                        },

                        sum: { $sum: '$pageviews.views' }
                    }
                } */
            ], function (err, result) {
                result.toArray(function (err, documents) {
                    console.log('risposta')
                    //console.log(documents.length)
                    resolve(documents)
                })
            });
        }
    })
}

// permette di visualizzare statistiche quali la somma delle views delle pagine
app.get('/views', function (req, res) {
    let options = { explain: true };
    query_views(req)
        .then(result => {
            console.log(result.length)
            res.send(result.filter(x => {return x.views > 0}))
        })
        .catch(err => {
            console.log(err);
            res.status(404).send(err)
        })

})

app.get('/lang', function (req, res) {
    let collection = db.collection(req.query.city)
    collection.distinct('lang').then((data) => {
        res.send(data.sort());
    })
})
// creazione admin
/* var u = user.newUser({
        username: "admin",
        mail: "admin@mail.it"
    });
    console.log('untente nuovo')
    u.setAdmin();
    u.setModerator();
    u.setPassword("admin");
    console.log('ho settato tutto')

    u.save().then(() => {console.log('admin creato'.green)}).catch(err =>{
        console.log(err)
        console.log('errore'.red)
    }) */

 // per scrivere una collezione su un file
/*
    let collection = db.collection('Londra');
    collection.findOne({}).then((documents)=> {
        if (err) console.error(err);
        let doc = JSON.stringify(documents);
            fs.writeFile('schema', doc, function(err){
                if (err) throw err;
                console.log('Sucessfully saved!');
            });
      }); */
