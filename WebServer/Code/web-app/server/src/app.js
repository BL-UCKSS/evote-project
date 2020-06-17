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

// sso user login 세션 관리용
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');

let network = require('./fabric/network.js');

// mongoose 모듈 사용
let mongoose = require('mongoose');

let database;
let UserSchema;
let UserModel;

function connectDB() {
  let databaseUrl = 'mongodb://localhost:27017/local';
  
  mongoose.Promise = global.Promise;
  mongoose.connect(databaseUrl);
  database = mongoose.connection;
  
  database.on('open', function() {
    console.log('데이터베이스에 연결됨 : ' + databaseUrl);
      
          
    UserSchema = mongoose.Schema({
      stdno: {type:String, required:true, unique:true},
      password: {type:String, required:true},
      name: {type:String, index:'hashed'},
      grade: {type:Number, default:1, required:true},
      dept: {type:String, required:true},
      stat: {type:String, required:true},
      email: {type:String, required:true},
    });
    console.log('UserSchema 정의함.');
      
    //함수 등록(이후 모델 객체에서 사용가능)
    UserSchema.static('findById', function(stdno, callback) {
      return this.find({stdno:stdno}, callback);        
    });
          
    UserSchema.static('findAll', function(callback){
      return this.find({}, callback);        
    });
          
    UserModel = mongoose.model('ssousers', UserSchema);
    console.log('UserModel 정의함.');
      
  });
  
  database.on('disconnected', function(){
    console.log('데이터베이스 연결 끊어짐.');    
  });
  
  database.on('error', console.error.bind(console, 'mongoose 연결 에러.'));
}

const app = express();
//app.use(morgan('combined'));
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
app.use(cors());
app.use('/public', servestatic(path.join(process.cwd(), 'public')));
app.use('/img', servestatic(path.join(process.cwd(), 'public/img')));

app.use(cookieParser());
app.use(expressSession({
  secret:'my key',
  resave:true,
  saveUninitialized:true
}));

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

// SSO 로그인 관련 router
let authUser = function(database, stdno, password, callback) {
  console.log('authUser 호출됨 : ' + stdno + ', ' + password);
  
  UserModel.findById(stdno, function(err, result) {
    if(err) {
      callback(err, null);
      return;
    }
    console.log('아이디 %s로 검색됨.');
    if(result.length > 0){
      if(result[0]._doc.password === password) {
        console.log('비밀번호 일치함.');
        callback(null, result);
      } else {
        console.log('비밀번호 일치하지 않음.');
        callback(null, null);
      }
    }else{
      console.log('아이디 일치하는 사용자 없음.');
      callback(null, null);
    }
  });
  
};

app.post('/process/login', async (req, res) => {
  console.log('/process/login 라우팅 함수 호출됨.');
      
  let paramStdno = req.body.voterId || req.query.voterId;
  let paramPassword = req.body.password || req.query.password;
  console.log('요청 파라미터 : ' + paramStdno + ', ' + paramPassword);    
  
  if (database) {
    authUser(database, paramStdno, paramPassword, function(err, docs) {
      if(err){
        console.log('에러 발생.');
        //에러발생
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }
                  
      if(docs){
        console.dir(docs);
        //사용자 로그인 성공
        let context = {success:'login successful'};
        res.send(context);
        return;
      }else{
        console.log('에러 발생.');
        //사용자 데이터 조회 안됨
        let context = {error:'no user'};
        res.send(context);
        return;
      }
    });  
  }else {
    console.log('에러 발생.');
    //데이터베이스 연결 안됨
    let context = {error:'Database is not connected'};
    res.send(context);
    return;    
  }
});

// vote 관련 router
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

  //DB연결
  connectDB();
});