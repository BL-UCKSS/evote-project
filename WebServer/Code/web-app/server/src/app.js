/* eslint-disable require-atomic-updates */
'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
//const morgan = require('morgan');
//const util = require('util');
const path = require('path');
const fs = require('fs');
const servestatic = require('serve-static');

let network = require('./fabric/network.js');

const app = express();
//app.use(morgan('combined'));
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
app.use(cors());
app.use('/public', servestatic(path.join(process.cwd(), 'public')));
app.use('/img', servestatic(path.join(process.cwd(), 'public/img')));

app.set('views', path.join(process.cwd(), '/views'));
app.set('view engine', 'ejs');

const configPath = path.join(process.cwd(), './config.json');
const configJSON = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configJSON);

//use this identity to query
const appAdmin = config.appAdmin;

const htmlrender = function(req, res, fname, context){
  req.app.render(fname, context, function(err, html){
    if(err){
      res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
      res.write('<h1>뷰 렌더링 중 에러 발생</h1>');
      res.write('<br><p>'+err.stack + '</p>');
      res.end();
      return;
    }
    res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
    res.end(html);
  });
};

app.get('/', async (req, res) => {
  let context = {};
  htmlrender(req, res, 'home', context);
});

app.get('/queryallpage', async (req, res) => {
  let context = {};
  htmlrender(req, res, 'queryall', context);
});

app.get('/querybytype', async (req, res) => {
  let context = {};
  htmlrender(req, res, 'querybytype', context);
});

app.get('/querybykey', async (req, res) => {
  let context = {};
  htmlrender(req, res, 'querybykey', context);
});

app.get('/checkrating', async (req, res) => {
  let context = {};
  htmlrender(req, res, 'checkrating', context);
});

app.get('/castBallot', async (req, res) => {
  let context = {};
  htmlrender(req, res, 'vote', context);
});

//get all assets in world state
app.get('/queryAll', async (req, res) => {

  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'queryAll', '');
  let parsedResponse = await JSON.parse(response);
  res.send(parsedResponse);

});

app.get('/getCurrentStanding', async (req, res) => {

  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'queryByObjectType', 'votableItem');
  let parsedResponse = await JSON.parse(response);
  ////console.log(parsedResponse);
  res.send(parsedResponse);

});

//vote for some candidates. This will increase the vote count for the votable objects
app.post('/castBallot', async (req, res) => {
  let networkObj = await network.connectToNetwork(req.body.voterId);
  ////console.log('util inspecting');
  ////console.log(util.inspect(networkObj));
  req.body = JSON.stringify(req.body);
  console.log('req.body');
  console.log(req.body);
  let args = [req.body];

  let response = await network.invoke(networkObj, false, 'castVote', args);
  if (response.error) {
    res.send(response.error);
  } else {
    ////console.log('response: ');
    ////console.log(response);
    // let parsedResponse = await JSON.parse(response);
    res.send(response);
  }
});

//query for certain objects within the world state
app.post('/queryWithQueryString', async (req, res) => {
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'queryByObjectType', req.query.selected);
  let parsedResponse = await JSON.parse(response);
  res.send(parsedResponse);

});

//get voter info, create voter object, and update state with their voterId
app.post('/registerVoter', async (req, res) => {
  ////console.log('req.body: ');
  ////console.log(req.body);
  let voterId = req.body.voterId;

  //first create the identity for the voter and add to wallet
  let response = await network.registerVoter(voterId, req.body.registrarId, req.body.firstName, req.body.lastName);
  ////console.log('response from registerVoter: ');
  ////console.log(response);
  if (response.error) {
    res.send(response.error);
  } else {
    ////console.log('req.body.voterId');
    ////console.log(req.body.voterId);
    let networkObj = await network.connectToNetwork(voterId);
    ////console.log('networkobj: ');
    ////console.log(networkObj);

    if (networkObj.error) {
      res.send(networkObj.error);
    }
    ////console.log('network obj');
    ////console.log(util.inspect(networkObj));


    req.body = JSON.stringify(req.body);
    let args = [req.body];
    //connect to network and update the state with voterId  

    let invokeResponse = await network.invoke(networkObj, false, 'createVoter', args);
    
    if (invokeResponse.error) {
      res.send(invokeResponse.error);
    } else {

      //console.log('after network.invoke ');
      let parsedResponse = JSON.parse(invokeResponse);
      parsedResponse += '. Use voterId to login above.';
      res.send(parsedResponse);

    }

  }


});

//used as a way to login the voter to the app and make sure they haven't voted before 
app.post('/validateVoter', async (req, res) => {
  //console.log('req.body: ');
  //console.log(req.body);
  let networkObj = await network.connectToNetwork(req.body.voterId);
  //console.log('networkobj: ');
  //console.log(util.inspect(networkObj));

  if (networkObj.error) {
    res.send(networkObj);
  }

  let invokeResponse = await network.invoke(networkObj, true, 'readMyAsset', req.body.voterId);
  if (invokeResponse.error) {
    res.send(invokeResponse);
  } else {
    //console.log('after network.invoke ');
    let parsedResponse = await JSON.parse(invokeResponse);
    if (parsedResponse.ballotCast) {
      let response = {};
      response.error = 'This voter has already cast a ballot, we cannot allow double-voting!';
      res.send(response);
    }
    // let response = `Voter with voterId ${parsedResponse.voterId} is ready to cast a ballot.`  
    res.send(parsedResponse);
  }

});

app.post('/queryByKey', async (req, res) => {
  //console.log('req.body: ');
  //console.log(req.body);

  let networkObj = await network.connectToNetwork(appAdmin);
  //console.log('after network OBj');
  let response = await network.invoke(networkObj, true, 'readMyAsset', req.body.key);
  response = JSON.parse(response);
  if (response.error) {
    //console.log('inside eRRRRR');
    res.send(response.error);
  } else {
    //console.log('inside ELSE');
    res.send(response);
  }
});

app.all('*', function(req, res) {
  res.status(404).send('<h1>요청하신 페이지는 없어용.</h1>');
});

app.listen(process.env.PORT || 8081, function(){
  console.log('server is running : '+8081);
});