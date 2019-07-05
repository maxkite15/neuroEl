// Import the express lirbary
const express = require('express')
const bodyParser = require('body-parser');
const {ipcMain} = require('electron');

let appConfig = require('./neuroConfig');

// Import the axios library, to make HTTP requests
const axios = require('axios');


// Create a new express application and use
// the express static middleware, to serve all files
// inside the public directory
const app = express();
app.use(express.static(__dirname + '/src/public'));
app.use(bodyParser.urlencoded({extend:true}));

let first_enter = true;
let curr_access_token = '';
let client_id = '';
let client_secret = '';
let state = '';

ipcMain.on('get-curr-access-token', (event, arg) => {
    event.returnValue = curr_access_token;
});

ipcMain.on('get-app-config', (event, arg) => {
    event.returnValue = appConfig;
});

app.post('/token', function (req, res) {
    if(first_enter) {
        //res.redirect(`/neuro.html?access_token=${req.body.access_token}`);
        res.redirect('/neuro.html');
        first_enter = false;
    }
    curr_access_token = req.body.access_token;
});

app.post('/get_token', function (req, res) {
    //здесь вообще надо в качестве redirect_uri указать что-то типа http://localhost:8180/token
    let redirect_uri = req.body.redirect_uri ? req.body.redirect_uri : 'http://localhost:8180/token/';
    client_id = req.body.client_id ? req.body.client_id : client_id;
    client_secret = req.body.client_secret ? req.body.client_secret : client_secret;
    state = req.body.state ? req.body.state : state;
    let url = `http://cdb.neurop.org:8080/npe/connect/authorize?client_secret=${client_secret}&client_id=${client_id}&response_type=token&response_mode=form_post&redirect_uri=${redirect_uri}&scope=api&state=${state}`;
    console.log(url);
    if(!client_id || !client_secret || !state){
        res.status(500).send('All fields must be filled!');
    }
    res.status(301).redirect(url);
});

app.get('/chart_data', function(req, res) {
    let userIdsCond = appConfig.userIds.length ? `&UserIds=${appConfig.userIds.join('&UserIds=')}` : '';
    let start = req.query.Start;
    let stop = req.query.Stop;
    let group = req.query.Group;
    let qclass = req.query.Class;
    let kind = req.query.Kind;
    //start = '2019-06-05T10:00:00';
    //stop = '2019-06-05T15:00:00';
    let url = `https://cdb.neurop.org/api/secured/eventdata/find?Start=${start}&Stop=${stop}&Group=${group}&Class=${qclass}&Kind=${kind}${userIdsCond}`;
    console.log('URL: ', url);
    axios({
        method: 'get',
        url: url,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': 'Bearer '+curr_access_token
        }
    }).then((response) => {
        console.log('Response Data: ', response.data);
        res.send({
            data: response.data
        });
    })
    .catch(function (error) {
        console.log(error.message);
        res.status(500).send({
            error: error,
            error_response_data: error.response.data
        });
    })
});

// Start the server on port 8180
let port = process.env.PORT || 8180;
console.log('PORT: ', port);
app.listen(port);
