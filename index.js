// Import the express lirbary
const express = require('express');
const bodyParser = require('body-parser');
const socketIo = require("socket.io");

let appConfig = require('./neuroConfig');

// Import the axios library, to make HTTP requests
const axios = require('axios');

let appCookies = null;

module.exports.initAppCookies = (session)=>{
    appCookies = session.defaultSession.cookies;
    appCookies.get({url: 'http://localhost:8180'}, (error, cookies)=>{
        if(error){
            console.log('COOKIE ERROR: ', error);
        }
        let userIdsCookie = cookies.filter(item=>{
            return item.name==='userIds';
        });
        if(userIdsCookie.length>0){
            userIds = userIdsCookie[0].value.split(',');
            console.log('userIds from cookies: ', userIds);
        }
    });
};

// Create a new express application and use
// the express static middleware, to serve all files
// inside the public directory
const app = express();
app.use(express.static(__dirname + '/src/public'));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

const redirect_uri = 'http://localhost:8180/token/';
let first_enter = true;
let curr_access_token = '';
let curr_expires_in = 0;
let userIds = [];

app.post('/token', function (req, res) {
    res.redirect('/neuro.html');

    curr_access_token = req.body.access_token;
    curr_expires_in = req.body.expires_in;

    if(clientSocket) {
        clientSocket.emit("NewToken", {
            token: curr_access_token,
            expires_in: curr_expires_in
        });
    }
});

app.get('/',function (req, res) {
    let url = `http://cdb.neurop.org:8080/npe/connect/authorize?client_secret=${appConfig.client_secret}&client_id=${appConfig.client_id}&response_type=token&response_mode=form_post&redirect_uri=${redirect_uri}&scope=api&state=${appConfig.state}`;
    console.log(url);
    if(!appConfig.client_id || !appConfig.client_secret || !appConfig.state){
        res.status(500).send('Some of auth params from configuration is empty!');
    }
    res.status(301).redirect(url);
});


app.post('/get_token', function (req, res) {
    let url = `http://cdb.neurop.org:8080/npe/connect/authorize?client_secret=${appConfig.client_secret}&client_id=${appConfig.client_id}&response_type=token&response_mode=form_post&redirect_uri=${redirect_uri}&scope=api&state=${appConfig.state}`;
    console.log(url);
    if(!appConfig.client_id || !appConfig.client_secret || !appConfig.state){
        res.status(500).send('Some of auth params from configuration is empty!');
    }
    res.status(301).redirect(url);
});

app.post('/update_user_ids', function (req, res) {
    userIds = req.body.userIds;

    let currDate = new Date();
    let cookie = {url: 'http://localhost:8180', name: 'userIds', value: userIds.join(','), expirationDate: currDate.setDate(currDate.getDate()+7)};
    appCookies.set(cookie, (error)=>{
        if(error){
            console.log('Cookies update Error: ', error);
        }else{
            console.log('Success cookies update');
        }
    });

    appCookies.get({url: 'http://localhost:8180'}, (error, cookies)=>{
        if(error){
            console.log('COOKIE ERROR: ', error);
        }
        console.log('-----COOKIES-----: ', cookies);
    });

    clientSocket.emit("userIds", {
        userIds: userIds
    });
    res.send('Success update!');
});

app.get('/chart_data', function(req, res) {
    let userIdsCond = userIds && userIds.length ? `&UserIds=${userIds.join('&UserIds=')}` : '';
    let start = req.query.Start;
    let stop = req.query.Stop;
    let group = req.query.Group;
    let qclass = req.query.Class;
    let kind = req.query.Kind;
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
const server = app.listen(port);

const io = socketIo(server);

let clientSocket = null;

io.on("connection", socket => {
    console.log("New client connected");
    clientSocket = socket;
    clientSocket.emit("userIds", {
        userIds: userIds
    });
    clientSocket.emit("NewToken", {
        token: curr_access_token,
        expires_in: curr_expires_in,
        auth_url: `http://cdb.neurop.org:8080/npe/connect/authorize?client_secret=${appConfig.client_secret}&client_id=${appConfig.client_id}&response_type=token&response_mode=form_post&redirect_uri=${redirect_uri}&scope=api&state=${appConfig.state}`
    });
    clientSocket.emit("appConfig", appConfig);
    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});