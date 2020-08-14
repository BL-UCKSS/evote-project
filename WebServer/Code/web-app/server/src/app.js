/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable no-tabs */
/* eslint-disable require-atomic-updates */
'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const servestatic = require('serve-static');
const crypto = require('crypto');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');
//const morgan = require('morgan');
//const util = require('util');

const configPath = path.join(process.cwd(), './config.json');
const configJSON = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configJSON);

//use this identity to query
const appAdmin = config.appAdmin;

let network = require('./fabric/network.js');
let mongoose = require('mongoose');
const storage = multer.diskStorage({
  destination : (req, file, cb) => {
    cb(null, 'public/img/');
  },
  filename : (req, file, cb) => {
    let name = req.body.name + file.originalname;
    let c = crypto.createHash('sha256').update(name).digest('hex').substring(0, 10);
    cb(null, c+'.'+file.mimetype.split('/')[1]);
  }
});
const upload = multer({storage: storage});
const storage2 = multer.diskStorage({
  destination : (req, file, cb) => {
    cb(null, 'public/img/');
  },
  filename : (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload2 = multer({storage: storage2});

let database;
let UserSchema;
let PersonalAgreeSchema;
let CandidateSchema;
let UserModel;
let PersonalAgreeModel;
let CandidateModel;
let AdminSchema;
let AdminModel;

//functions
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

    PersonalAgreeSchema = mongoose.Schema({
      stdno: {type:String, required:true, unique:true},
      name: {type:String, index:'hashed', required:false},
      dept: {type:String, required:false},
      univ: {type:String, required:false},
    });
    console.log('PersonalAgreeSchema 정의함.');

    CandidateSchema = mongoose.Schema({
      electionid: {type:String, required:true},
      hname: {type:String, required:true},
      icon: {type:String, required:true},
      link: {type:String, required:false},
      hakbun1: {type:Number, required:true},
      name1: {type:String, index:'hashed', required:true},
      dept1: {type:String, required:true},
      grade1: {type:Number, required:true},
      profile1: {type:String, required:true},
      hakbun2: {type:Number, required:true},
      name2: {type:String, index:'hashed', required:true},
      dept2: {type:String, required:true},
      grade2: {type:Number, required:true},
      profile2: {type:String, required:true},
    });
    console.log('CandidateSchema 정의함.');

    AdminSchema = mongoose.Schema({
      id: {type:String, required:true, unique:true},
      pw: {type:String, required:true},
      name: {type:String, index:'hashed'},
      email: {type:String, required:true},
    });
    console.log('AdminSchema 정의함.');
      
    //함수 등록(이후 모델 객체에서 사용가능)
    UserSchema.static('findById', function(stdno, callback) {
      return this.find({stdno:stdno}, callback);        
    });
          
    UserSchema.static('findAll', function(callback){
      return this.find({}, callback);        
    });

    PersonalAgreeSchema.static('findById', function(stdno, callback){
      return this.find({stdno:stdno}, callback);
    });

    PersonalAgreeSchema.static('findAll', function(callback){
      return this.find({}, callback);        
    });

    CandidateSchema.static('findById', function(no, callback){
      return this.find({no:no}, callback);
    });

    CandidateSchema.static('findByElectId', function(electId,callback){
      return this.find({electionid:electId}, callback);        
    });

    CandidateSchema.static('registerCandidate', function(data){
      let candy = new this(data);
      return candy.save();
    });

    CandidateSchema.static('updateById', function(electionid, data) {
      return this.update({electionid:electionid}, 
        {$set : {hname:data.hname,link:data.link,hakbun1:data.hakbun1,name1:data.name1,dept1:data.dept1,grade1:data.grade1,hakbun2:data.hakbun2,name2:data.name2,dept2:data.dept2,grade2:data.grade2}});
    });

    CandidateSchema.static('removeCandidate', function(electId){
      return this.deleteMany({electionid:electId});      
    });

    AdminSchema.static('findById', function(adminid, callback) {
      return this.find({id:adminid}, callback);        
    });

    AdminSchema.static('updateById', function(adminid, _email) {
      return this.update({id:adminid}, {$set : {email:_email}});
    });
  
    UserModel = mongoose.model('ssousers', UserSchema);
    console.log('UserModel 정의함.');

    PersonalAgreeModel = mongoose.model('personalagree', PersonalAgreeSchema);
    console.log('PersonalAgreeSchema 정의함.');
      
    CandidateModel = mongoose.model('candidates', CandidateSchema);
    console.log('CandidateModel 정의함.');

    AdminModel = mongoose.model('adminusers', AdminSchema);
    console.log('AdminModel 정의함.');
  });
  
  database.on('disconnected', function(){
    console.log('데이터베이스 연결 끊어짐.');    
  });
  
  database.on('error', console.error.bind(console, 'mongoose 연결 에러.'));
}
let getElectIdByYearUniv = async function(year, univ){
  year = String(year);
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'queryByObjectType', 'election');
  let res = JSON.parse(JSON.parse(response));
  let i = 0;
  let cnt = 0;
  if(res.length === 0){
    return false;
  }
  for(; i<res.length; i++){
    if(res[i].Record.startDate.substring(0,4) === year && res[i].Record.univ === univ){
      cnt++;
      break;
    }
  }
  if(cnt === 0){
    console.log(univ + '에 맞는 선거가 열리지 않았습니다.');
    return false;
  }
  return res[i].Key;
};
let getHashPw = function(database, stdno, callback) {
  console.log('getHashPw 호출됨 : ' + stdno);
  
  UserModel.findById(stdno, function(err, result) {
    if(err) {
      callback(err, null);
      return;
    }
    console.log('아이디 %s로 검색됨.', stdno);
    if(result.length > 0){
      callback(null, result[0].password);
    }else{
      console.log('아이디 일치하는 사용자 없음.');
      callback(null, null);
    }
  });
};
let registerCandidate = async function(database, data) {
  console.log('registerCandidate 호출됨');
  await CandidateModel.registerCandidate(data);
};
let removeCandidate = async function(database, data) {
  console.log('removeCandidate 호출됨');
  await CandidateModel.removeCandidate(data);
};
let adminEmail = function(database, callback) {
  console.log('adminEmail 호출됨');
  
  AdminModel.findById('admin', function(err, result) {
    if(err) {
      callback(err, null);
      return;
    }
    if(result.length > 0){
      callback(null, result[0]._doc.email);
    }else{
      console.log('아이디 일치하는 관리자 없음.');
      callback(null, null);
    }
  });
};
let updateAdminEmail = async function(database, id, email) {
  console.log('updateAdminEmail 호출됨');
  await AdminModel.updateById(id, email);
};
let modifyCandidate = async function(database, id, data) {
  console.log('updateAdminEmail 호출됨');
  await CandidateModel.updateById(id, data);
};
// SSO 로그인 관련 router
let authUser = function(database, stdno, password, callback) {
  console.log('authUser 호출됨 : ' + stdno + ', ' + password);
  
  UserModel.findById(stdno, function(err, result) {
    if(err) {
      callback(err, null);
      return;
    }
    console.log('아이디 %s로 검색됨.', stdno);
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
let authAdmin = function(database, id, pw, callback) {
  console.log('authAdmin 호출됨 : ' + id + ', ' + pw);
  
  AdminModel.findById(id, function(err, result) {
    if(err) {
      callback(err, null);
      return;
    }
    console.log('관리자 아이디 %s로 검색됨.', id);
    if(result.length > 0){
      if(result[0]._doc.pw === pw) {
        console.log('비밀번호 일치함.');
        callback(null, result);
      } else {
        console.log('비밀번호 일치하지 않음.');
        callback(null, null);
      }
    }else{
      console.log('아이디 일치하는 관리자 없음.');
      callback(null, null);
    }
  });
};
//사용자를 개인정보처리동의 DB에 추가하는 함수
let personalAgree = function(database, stdno, callback) {
  
  let pAgree = new PersonalAgreeModel({stdno:stdno});
  console.log('personalAgree 호출됨 : ' + stdno);
  
  pAgree.save(function(err) {
    if(err) {
      callback(err, null);
      return;
    }
    console.log('('+ stdno +') 개인정보처리동의 데이터 추가함.');
    callback(null, pAgree);
  });
};
//사용자가 개인정보처리에 동의했는지 확인하는 함수(vote 페이지에서)
let checkAgree = function(database, stdno, callback){
  console.log('checkAgree 호출됨 : ' + stdno);

  PersonalAgreeModel.findById(stdno, function(err, result) {
    if(err) {
      callback(err, null);
      return;
    }

    console.log('학번 %s로 검색됨.', stdno);
    console.log(result);
    
    if(result.length > 0){      //사용자가 DB에 존재
      callback(null, result);
    }else{
      console.log('학번 일치하는 사용자 없음.');
      callback(null, {error:'no user'});
    }
  });
};
//사용자가 개인정보처리에 동의했는지 확인하는 함수(sign 페이지에서)
let existAgree = function(database, stdno, callback){
  console.log('existAgree 호출됨 : ' + stdno);

  //개인정보처리에 동의했는지 확인
  PersonalAgreeModel.findById(stdno, function(err, result) {
    if(err) {
      callback(err, null);
      return;
    }

    console.log('학번 %s로 검색됨.', stdno);
    
    if(result.length > 0){      //사용자가 이미 동의함
      console.log('(' +stdno+ ')님이 이미 개인정보처리 동의를 완료했습니다.');
      callback(null, result);
    }else{ 
      console.log('학번 일치하는 사용자 없음.');
      personalAgree(database, stdno, function(err){
        if(err) {
          callback(err, null);
          return;
        }
        else {
          console.log('(' +stdno+ ')님의 개인정보처리 동의를 완료했습니다.');
          callback(null, result);
        }
      });
    }
  });
};
let loadCandidateByElectId = function(database, electId, callback) {
  console.log('loadCandidateByElectId 호출됨 : ' + electId);
  
  CandidateModel.findByElectId(electId, function(err, result) {
    if(err) {
      callback(err, null);
      return;
    }
    if(result.length > 0){
      callback(null, result);
    }else{
      console.log('일치하는 기호 없음.');
      callback(null, null);
    }
  });
  
};

let registerUser = async function(walletId, gubun, univ){
  let response = await network.registerVoter(walletId);
  if (response.error) {
	    // eslint-disable-next-line no-mixed-spaces-and-tabs
	    console.log(response.error);
  } else {
    console.log('registerUser 호출됨');
    /*let networkObj = await network.connectToNetwork(walletId);
    if (networkObj.error) {
      console.log(networkObj.error);
    }
    let year = new Date();
    year = String(year.getFullYear());
    let argument = JSON.stringify({voterId:walletId, department:univ, year:year}); 
    let args = [argument];

    //connect to network and update the state with voterId
    let invokeResponse;
    if (gubun === 'user'){
	      invokeResponse = await network.invoke(networkObj, false, 'createVoter', args);
    }else if(gubun === 'admin'){
      console.log('admin logged in');
    }else{
      console.log('error');
      return;
    }
    if(invokeResponse){
      if (invokeResponse.error) {
        console.log(invokeResponse.error);
      } else {
        //console.log('after network.invoke ');
        let parsedResponse = JSON.parse(invokeResponse);
        parsedResponse += '. Use walletId to login above.';
        console.log(parsedResponse);
      }
    }*/
  }
};
// let loadCandidate = function(database, no, callback) {
//   console.log('loadCandidate 호출됨 : ' + no);
  
//   CandidateModel.findById(no, function(err, result) {
//     if(err) {
//       callback(err, null);
//       return;
//     }
//     if(result.length > 0){
//       callback(null, result);
//     }else{
//       console.log('일치하는 기호 없음.');
//       callback(null, null);
//     }
//   });
// };
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

app.get('/', async (req, res) => {
  res.redirect('/login');
});

app.get('/login', async (req, res) => {
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'login', context);
});

app.get('/main', async (req, res) => {
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'main', context);
});

app.get('/adminMain', async (req, res) => {
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'adminMain', context);
});

app.get('/adminNow', async (req, res) => {
  let total = 12; //재학생 수
  let arr = [];
  let networkObj = await network.connectToNetwork(appAdmin);
  let resElection = await network.invoke(networkObj, true, 'queryByObjectType', 'election');
  let parsedElection = await JSON.parse(resElection);
  parsedElection = await JSON.parse(parsedElection);
  
  let now = new Date();
  //선거 목록 출력 후 선거별로 투표율 계산 및 출력
  for (let i in parsedElection){
    let count = 0;
    let t1 = new Date(parsedElection[i].Record.startDate);
    let t2 = new Date(parsedElection[i].Record.endDate);
    if(now >= t1 && now <= t2){ 
      //해당 선거의 투표율을 확인해야하지만, 현재 querybyobjecttype voter는 type을 구분할 수 없음.votableItem
      let parsedVotablItems = await network.invoke(networkObj, true, 'queryByObjectType', 'votableItem');
      parsedVotablItems = JSON.parse(JSON.parse(parsedVotablItems));
      for(let j=0; j<parsedVotablItems.length; j++){
        count += parsedVotablItems[j].Record.count;
      }
      let avg = count / total * 100;
      let nowTime = new Date().toISOString();
      if(parsedElection[i].Record.endDate > nowTime){
        arr.push({
          name: parsedElection[i].Record.name,
          enddate: parsedElection[i].Record.endDate.replace(/-/g, '.').substring(2, 10),
          avg: avg.toFixed(2),
        });
      }
    }
  }
  
  let context = {
    session:req.session,
    list: arr
  };

  htmlrender(req, res, 'adminNow', context);
});

app.get('/adminManage', async (req, res) => {

  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'queryByObjectType', 'election');
  let list = JSON.parse(JSON.parse(response));
  //console.log('response : ' + JSON.stringify(list));
  if(response.error){
    console.log('adminManage error : ' + response.error);
  }
  let context = {
    session:req.session,
    list:list
  };
  htmlrender(req, res, 'adminManage', context);
});
app.get('/myvote', async (req, res) => {
  let userid = req.session.userid;
  let pw = ''; //pw from db
  if (database) {
    getHashPw(database, userid, async function(err, docs) {
      if(err){
        console.log('에러 발생.');
        //에러발생
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }
      if(docs){
        pw = docs;
        let useridpw = userid + pw;
        let walletid = crypto.createHash('sha256').update(useridpw).digest('base64');
        let networkObj = await network.connectToNetwork(walletid);
        let response = await network.invoke(networkObj, true, 'readMyAsset', walletid); //walletid만 넘기겠음
        let nolist = false;
        let arr = [];
        response = JSON.parse(response);
        if (response.error) {
          console.log(response.error);
          nolist = true;
        }
        if(response.length === 0){
          nolist = true;
        }
        let year = new Date();
        year = String(year.getFullYear());
        for(let i=0; i<response.length; i++){
          if(response[i].totalElectionCast){
            arr.append(year + response[i].totalElectionPicked);
          }
        }
        arr = [];
        //총학생회
        let res1 = await network.invoke(networkObj, true, 'readMyAsset', walletid); 
        res1 = JSON.parse(res1);
        let name;
        if(res1.totalElectionCast){
          name = res1.totalElectionPicked;
          let res2 = await network.invoke(networkObj, true, 'queryByObjectType', 'votableItem');
          res2 = JSON.parse(JSON.parse(res2));
          let electionid;
          for(let i=0; i<res2.length; i++){
            if(year+name === res2[i].Key){
              electionid = res2[i].Record.electionId;
            }
          }
          let res3 = await network.invoke(networkObj, true, 'readMyAsset', electionid);
          res3 = JSON.parse(res3);
          arr.push({
            election:res3.name,
            name:name
          });
        }
        //단과대
        if(res1.departmentElectionCast){
          name = res1.departmentElectionPicked;
          let res2 = await network.invoke(networkObj, true, 'queryByObjectType', 'votableItem');
          res2 = JSON.parse(JSON.parse(res2));
          let electionid;
          for(let i=0; i<res2.length; i++){
            if(year+name === res2[i].Key){
              electionid = res2[i].Record.electionId;
            }
          }
          let res3 = await network.invoke(networkObj, true, 'readMyAsset', electionid);
          res3 = JSON.parse(res3);
          arr.push({
            election:res3.name,
            name:name
          });
        }
        let context = {
          session:req.session,
          list:arr,
          nolist:nolist
        };
        htmlrender(req, res, 'myvote', context);
      }else{
        console.log('에러 발생.');
        //사용자 데이터 조회 안됨
        let context = {error:'no user'};
        console.log(context);
        res.end('<head><meta charset=\'utf-8\'></head><script>document.location.href=\'/main\';</script>');
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
app.get('/process/myvote/:election', async (req, res) => {
  console.log('/process/myvte/:election 라우팅 함수 호출됨.');

  let userid = req.session.userid;
  let pw = ''; //pw from db
  if (database) {
    getHashPw(database, userid, async function(err, docs) {
      if(err){
        console.log('에러 발생.');
        //에러발생
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }
      if(docs){
        pw = docs;
        let useridpw = userid + pw;
        let walletid = crypto.createHash('sha256').update(useridpw).digest('base64');
        let networkObj = await network.connectToNetwork(walletid);
        let response = await network.invoke(networkObj, true, 'readMyAsset', walletid); //walletid만 넘기겠음
        let nolist = false;
        let arr = [];
        response = JSON.parse(response);
        if (response.error) {
          console.log(response.error);
          nolist = true;
        }
        if(response.length === 0){
          nolist = true;
        }
        let year = new Date();
        year = String(year.getFullYear());
        for(let i=0; i<response.length; i++){
          if(response[i].totalElectionCast){
            arr.append(year + response[i].totalElectionPicked);
          }
        }
        //arr 는 votableId 모음 집임
        let res1 = await network.invoke(networkObj, true, 'queryByObjectType', 'votableItem'); 
        res1 = JSON.parse(JSON.parse(res1));
        arr = [];
        for(let i=0; i<res1.length; i++){
          let len = res1[i].Key.length;
          let str = res1[i].Key.substring(4, len);
          arr.push({
            election: res1[i].Record.electionId,
            name: str
          });
        }
        //arr : electionid, name
        for(let i=0; i<arr.length; i++){
          let res2 = await network.invoke(networkObj, true, 'readMyAsset', arr[i].election);
          res2 = JSON.parse(res2);
          arr[i].election = res2.name;
        }
        let context = {
          session:req.session,
          list:arr,
          nolist:nolist
        };
        htmlrender(req, res, 'myvote', context);
      }else{
        console.log('에러 발생.');
        //사용자 데이터 조회 안됨
        let context = {error:'no user'};
        console.log(context);
        res.end('<head><meta charset=\'utf-8\'></head><script>document.location.href=\'/main\';</script>');
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
app.get('/sign', async (req, res) => {
  console.log(req.session);
  let univ = req.session.univ;
  let userid = req.session.userid;
  let stat = req.session.stat;
  let pw = ''; //pw from db

  if (stat !== '재학') {
    console.log(userid + ' 학생은 ' + stat +'상태 이므로 투표할 수 없습니다.');
    res.send('<head><meta charset=\'utf-8\'></head><script>alert(\'재학중인 학생만 투표가 가능합니다.\');document.location.href=\'/main\';</script>');
    return;
  }

  if (database) {
    getHashPw(database, userid, async function(err, docs) {
      if(err){
        console.log('에러 발생.');
        //에러발생
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }
      if(docs){
        pw = docs;
        let useridpw = userid + pw;
        let walletid = crypto.createHash('sha256').update(useridpw).digest('base64');
        let networkObj = await network.connectToNetwork(walletid);
        let response = await network.invoke(networkObj, true, 'readMyAsset', walletid); //walletid만 넘기겠음
        response = JSON.parse(response);
        if (response.error) {
          console.log(response.error);
        }
        if(!response.totalElectionCast){
          univ = '총학생회';
          let year = new Date();
          let electId = await getElectIdByYearUniv(year.getFullYear(), univ);
          if(!electId){
            console.log('에러 발생.');
            let context = {error:req.session.univ+' 선거가 존재하지 않음'};
            res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+context.error+'\');document.location.href=\'/main\';</script>');
            return;
          }
        }else if(!response.departmentElectionCast){
          univ = req.session.univ;
          let year = new Date();
          let electId = await getElectIdByYearUniv(year.getFullYear(), univ);
          if(!electId){
            console.log('에러 발생.');
            let context = {error:req.session.univ+' 선거가 존재하지 않음'};
            res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+context.error+'\');document.location.href=\'/main\';</script>');
            return;
          }
        }else{
          console.log('이미 모든 투표를 완료하였습니다.');
          response.end('<head><meta charset=\'utf-8\'></head><script>alert(\'이미 모든 투표를 완료했습니다.\');document.location.href=\'/main\';</script>');
          return;
        }

        //투표 기간이 되었는지 확인하기
        let ress = await network.invoke(networkObj, true, 'queryByObjectType', 'election');
        let list = JSON.parse(JSON.parse(ress));
        let curDate = new Date();
        let year = String(curDate.getFullYear());
        for(let i=0; i<list.length; i++){
          if(String(list[i].Record.startDate).substring(0,4) === year && list[i].Record.univ === univ){
            let t1 = new Date(list[i].Record.startDate);
            let t2 = new Date(list[i].Record.endDate);
            if(curDate >= t1 && curDate <= t2){
              console.log('투표기간입니다.');
              break;
            }else{
              console.log('투표 기간이 아닙니다.');
              res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'투표 기간이 아닙니다.\');document.location.href=\'/main\';</script>');
              return;
            }
          }
        }

        let context = {
          session:req.session,
          univ:univ
        };
        htmlrender(req, res, 'sign', context);
      }else{
        console.log('에러 발생.');
        //사용자 데이터 조회 안됨
        let context = {error:'no user'};
        console.log(context);
        res.end('<head><meta charset=\'utf-8\'></head><script>document.location.href=\'/main\';</script>');
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

app.get('/vote', async (req, res) => {
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'vote', context);
});

app.get('/vote2', async (req, res) => {
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'vote2', context);
});

app.get('/finvote', async (req, res) => {
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'finvote', context);
});

app.get('/registervote', async (req, res) => {
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'registervote', context);
});

app.get('/help', async (req, res) => {
  let mode = req.query.mode;
  if(database){
    adminEmail(database, function(err, email){
      console.log('관리자 이메일 : ' + email);
      let context = {
        session:req.session,
        email:email
      };
      if(mode === 'admin'){
        htmlrender(req, res, 'suggestion', context);
      }else{
        htmlrender(req, res, 'help', context);
      }
    });
  }else{
    console.log('에러 발생.');
    //데이터베이스 연결 안됨
    let context = {error:'Database is not connected'};
    res.send(context);
    return;    
  }
});

app.get('/logout', async (req, res) => {
  req.session.destroy(function(){
    req.session;
  });
  res.redirect('/login');
});

// vote 관련 router
app.get('/queryallpage', async (req, res) => {
  let context = {session:req.session};
  htmlrender(req, res, 'queryall', context);
});

app.get('/querybytype', async (req, res) => {
  let context = {session:req.session};
  htmlrender(req, res, 'querybytype', context);
});

app.get('/querybykey', async (req, res) => {
  let context = {session:req.session};
  htmlrender(req, res, 'querybykey', context);
});

app.get('/checkrating', async (req, res) => {
  let context = {session:req.session};
  htmlrender(req, res, 'checkrating', context);
});

app.get('/castBallot/:electId', async (req, res) => {

  let array = new Array();
  let context;
  let data;
  let electId;
  if (database) {
    //electId 조회
    electId = req.params.electId;
    // election id 별로 candidate 구분 구현 시 하드코딩 해제 : i<2
    loadCandidateByElectId(database, electId, function(err, docs) {
      if(err){
        console.log('에러 발생.');
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }
                  
      if(docs){
        // console.dir(docs);
        for(let i=0; i<docs.length; i++){
          data = {
            no: i+1,
            hakbun1: docs[i]._doc.hakbun1,
            hakbun2: docs[i]._doc.hakbun2,
            name1: docs[i]._doc.name1,
            name2: docs[i]._doc.name2,
            dept1: docs[i]._doc.dept1,
            dept2: docs[i]._doc.dept2,
            grade1: docs[i]._doc.grade1,
            grade2: docs[i]._doc.grade2,
            profile1: docs[i]._doc.profile1,
            profile2: docs[i]._doc.profile2,
            hname: docs[i]._doc.hname,
            icon: docs[i]._doc.icon,
            link: docs[i]._doc.link,
          };
          array.push(data);
        }
        context = {
          contents: array,
          session: req.session
        };
        console.log(context);
        htmlrender(req, res, 'vote', context);
      }else{
        console.log('에러 발생.');
        //사용자 데이터 조회 안됨
        let context = {error:'기호 없음'};
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

app.get('/personalAgree', async (req, res) => {
  let context = {
    voterId:req.session.userid,
    session:req.session
  };
  htmlrender(req, res, 'personalAgree', context);
});

app.get('/getDate', async (req, res) => {
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'queryAll', '');
  let parsedResponse = await JSON.parse(response);
  res.send(parsedResponse);
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
  let response = await network.invoke(networkObj, true, 'queryByObjectType', 'voter');
  let parsedResponse = await JSON.parse(response);
  ////console.log(parsedResponse);
  res.send(parsedResponse);

});

app.post('/process/removeElection', async(req,res) => {
  console.log('removeElection 호출됨');
  let electionid = req.body.electionid || req.query.electionid;
  console.log('electionid : '+ electionid);
  let args = {
    electionId : electionid
  };
  args = JSON.stringify(args);
  args = [args];
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, false, 'deleteElection', args);
  response = JSON.parse(response);
  if(database){
    if(response.success){
      //이미지 삭제하기
      loadCandidateByElectId(database, electionid, function(err, docs) {
        if(err){
          console.log('에러 발생.');
          let context = {error:'Error is occured'};
          res.send(context);
          return;
        }                      
        if(docs){
          for(let i=0; i<docs.length; i++){
            let filePath = __dirname + '/../public/img/' + docs[i]._doc.icon;
            fs.unlink(filePath, function(err){
              console.log(docs[i]._doc.icon + ' 파일 지워짐');
              if (err) {console.log(err);}
            });
            filePath = __dirname + '/../public/img/' + docs[i]._doc.profile1;
            fs.unlink(filePath, function(err){
              console.log(docs[i]._doc.profile1 + ' 파일 지워짐');
              if (err) {console.log(err);}
            });
            filePath = __dirname + '/../public/img/' + docs[i]._doc.profile2;
            fs.unlink(filePath, function(err){
              console.log(docs[i]._doc.profile2 + ' 파일 지워짐');
              if (err) {console.log(err);}
            });
          }
        }else{
          //선거가 존재하지 않을 때
          let response = {};
          response.error = '선거가 존재하지 않습니다.';
          res.send(response);
        }
      });
      //DB에도 선거 및 후보자 정보 삭제
      await removeCandidate(database, electionid);
      let response = {};
      response.success = '선거 정보가 삭제되었습니다.';
      res.send(response);
    }else{
      //데이터베이스 오류
      let response = {};
      response.error = '데이터베이스 오류';
      res.send(response);
    }
  }else{
    console.log('에러 발생.');
    //데이터베이스 연결 안됨
    let context = {error:'Database is not connected'};
    res.send(context);
    return;    
  }
});

app.post('/process/upload_image', upload2.array('image'), async(req,res) => {
  console.log('/process/upload_image 호출됨');
});

app.post('/modifyvote', async (req, res) => {
  let electionid = req.body.electionid || req.query.electionid;
  console.log('modifyvote 호출됨.');
  console.log('electionid : ' + electionid);
  let array = [];
  let networkObj = await network.connectToNetwork(appAdmin);
  let election = await network.invoke(networkObj, true, 'readMyAsset', electionid);
  election = JSON.parse(election);
  loadCandidateByElectId(database, election.electionId, function(err, docs) {
    if(err){
      console.log('에러 발생.');
      let context = {error:'Error is occured'};
      res.send(context);
      return;
    }                      
    if(docs){
      for(let i=0; i<docs.length; i++){
        let data = {
          hname: docs[i]._doc.hname,
          icon: docs[i]._doc.icon,
          link: docs[i]._doc.link,
          hakbun1: docs[i]._doc.hakbun1,
          name1: docs[i]._doc.name1,
          dept1: docs[i]._doc.dept1,
          grade1: docs[i]._doc.grade1,
          profile1: docs[i]._doc.profile1,
          hakbun2: docs[i]._doc.hakbun2,
          name2: docs[i]._doc.name2,
          dept2: docs[i]._doc.dept2,
          grade2: docs[i]._doc.grade2,
          profile2: docs[i]._doc.profile2,
        };
        array.push(data);
      }
      //console.log(array);
      let univList = ['총학생회','인문사회과학대학','사범대학','경영경제대학','융합공과대학','문화예술대학'];
      const idx = univList.indexOf(election.univ);
      if(idx > -1) {
        univList.splice(idx, 1);
      }
      let context = {
        session:req.session,
        electionData:election,
        candidateData:array,
        univList:univList
      };
    
      htmlrender(req, res, 'modifyvote', context);
    }else{
      console.log('에러 발생.');
      //사용자 데이터 조회 안됨
      let context = {error:'기호 없음'};
      res.send(context);
      return;
    }
  });
});

app.post('/process/modifyvote', async (req, res) => {
  console.log('/process/modifyvote 라우팅 함수 호출됨.');
  console.log(req.files);
  
  // ledger에 등록된 선거 수정
  let len = req.body.isMulti;
  console.log('len = ' + len);
  let hname = req.body.hname;
  if(!Array.isArray(hname)){
    hname = [hname];
  }
  let args = {
    electionId: req.body.electionid,
    name: req.body.name,
    univ: req.body.univ,
    startdate: req.body.startdate,
    enddate: req.body.enddate,
    candidates:hname
  };
  args = JSON.stringify(args);
  args = [args];
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, false, 'modifyElection', args);
  response = JSON.parse(response);
  if (response.error) {
    console.log('modifyElection error : ' + response.error);
    res.send('<script>alert("오류가 발생하였습니다.");document.location.href="/adminMain";</script>');
    return;
  }
  console.log('modifyElection response : ' + typeof response + ' => ' + JSON.stringify(response));
  if(database){
    // DB에 선거 및 후보자 정보를 수정한다.
    for(let i=0; i<len;i+=1){
      let data = {
        hname:req.body.hname[i],
        link:req.body.link[i],
        hakbun1:req.body.no1[i],
        name1:req.body.sname1[i],
        dept1:req.body.dept1[i],
        grade1:req.body.grade1[i],
        hakbun2:req.body.no2[i],
        name2:req.body.sname2[i],
        dept2:req.body.dept2[i],
        grade2:req.body.grade2[i],
      };
      await modifyCandidate(database, req.body.electionid, data);
    }
  }else{
    console.log('에러 발생.');
    //데이터베이스 연결 안됨
    let context = {error:'Database is not connected'};
    res.send(context);
    return;    
  }
  
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'adminMain', context);
});

app.post('/process/registervote', upload.fields([{name: 'image'},{name:'image1'},{name:'image2'}]), async (req, res) => {
  console.log('/process/registervote 호출됨.');
  // ledger에 선거 등록
  // electionid 같은 경우엔 체인코드에서 처리해도됨
  let len = req.body.isMulti;
  console.log('len = ' + len);
  let hname = req.body.hname;
  if(!Array.isArray(hname)){
    hname = [hname];
  }
  let args = {
    name: req.body.name,
    univ: req.body.univ,
    startdate: req.body.startdate,
    enddate: req.body.enddate,
    candidates:hname
  };
  args = JSON.stringify(args);
  args = [args];
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, false, 'createElection', args);
  response = JSON.parse(response);
  if (response.error) {
    console.log('registervote error : ' + response.error);
    res.send('<script>alert("오류가 발생하였습니다.");document.location.href="/adminMain";</script>');
    return;
  } 
  console.log('createElection response : ' + typeof response + ' => ' + response);
  // DB에 저장한다.
  if(database){
    // DB에 req.body의 값들을 삽입한다.
    let electionId = response.success;
    for(let i=0; i<len;i+=1){
      let data = {
        electionid:electionId,
        hname: Array.isArray(req.body.hname) ? req.body.hname[i] : req.body.hname,
        icon:req.files.image[i].filename,
        link:Array.isArray(req.body.link) ? req.body.link[i] : req.body.link,
        hakbun1:Array.isArray(req.body.no1) ? req.body.no1[i] : req.body.no1,
        name1:Array.isArray(req.body.sname1) ? req.body.sname1[i] : req.body.sname1,
        dept1:Array.isArray(req.body.dept1) ? req.body.dept1[i] : req.body.dept1,
        grade1:Array.isArray(req.body.grade1) ? req.body.grade1[i] : req.body.grade1,
        profile1:req.files.image1[i].filename,
        hakbun2:Array.isArray(req.body.no2) ? req.body.no2[i] : req.body.no2,
        name2:Array.isArray(req.body.sname2) ? req.body.sname2[i] : req.body.sname2,
        dept2:Array.isArray(req.body.dept2) ? req.body.dept2[i] : req.body.dept2,
        grade2:Array.isArray(req.body.grade2) ? req.body.grade2[i] : req.body.grade2,
        profile2:req.files.image2[i].filename,
      };
      await registerCandidate(database, data);
    }
  }else{
    console.log('에러 발생.');
    //데이터베이스 연결 안됨
    let context = {error:'Database is not connected'};
    res.send(context);
    return;    
  }
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'adminMain', context);
});

app.post('/help', async (req, res) => {
  let email = req.body.email || req.query.email;
  await updateAdminEmail(database, 'admin', email);
  let context = {
    session:req.session,
    email:email
  };
  htmlrender(req, res, 'suggestion', context);
});

app.post('/process/personalagree', async (req, res) => {
  console.log('/process/personalagree 라우팅 함수 호출됨.');

  let paramStdno = req.session.userid;
  console.log('요청 파라미터 : ' + paramStdno);    
  
  if (database) {
    personalAgree(database, paramStdno, function(err, docs) {
      if(err){
        console.log(err);
        console.log('에러 발생.');
        //에러발생
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }                  
      if(docs){
        //사용자 개인정보처리동의 성공
        let context = {success:'agree successful'};
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

app.post('/process/checkagree', async (req, res) => {
  console.log('/process/checkagree 라우팅 함수 호출됨.');

  let paramStdno = req.body.voterId || req.query.voterId;
  console.log('요청 파라미터 : ' + paramStdno);    
  
  if (database) {
    checkAgree(database, paramStdno, function(err, docs) {
      if(err){
        console.log(err);
        console.log('에러 발생.');
        //에러발생
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }
                  
      if(docs){
        let context = {votable:true};
        if(!docs.error){
          context = {votable:false};
        }
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

app.post('/process/existagree/:univ', async (req, res) => {
  console.log('/process/existagree 라우팅 함수 호출됨.');

  let paramStdno = req.session.userid;
  let univ = req.params.univ;
  console.log('요청 파라미터 : ' + paramStdno);    
  
  if (database) {
    //사용자가 사전에 동의했는지 체크 
    // 동의하지 않았다면 DB에 삽입. 이미 동의했을 경우, 바로 vote페이지로
    existAgree(database, paramStdno, async function(err, docs) {
      if(err){
        console.log(err);
        console.log('에러 발생.');
        //에러발생
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }
      if(docs){
        //DB불러와서 context에 넘겨줘야할 것들 : 후보자(Candidate) 정보
        //총학생회 선거 정보를 불러와야 함. -> 선거이름, 시작시간, 종료시간 
        //총학생회 선거 if(year == Date.now() && gubun == "총학") 일 때 첫번째로 출력됨.
        let year = new Date();
        let electId = await getElectIdByYearUniv(year.getFullYear(), univ);
        if(!electId){
          console.log('에러 발생.');
          let context = {error:'선거가 존재하지 않음'};
          res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+context.error+'\');document.location.href=\'/main\';</script>');
          return;
        }
        let array = [];
        // election id 별로 candidate 구분 구현 시 하드코딩 해제 : i<2
        loadCandidateByElectId(database, electId, function(err, docs) {
          if(err){
            console.log('에러 발생.');
            let context = {error:'Error is occured'};
            res.send(context);
            return;
          }         
          if(docs){
            for(let i=0; i<docs.length; i++){
              let data = {
                electionid: docs[i]._doc.electionid,
                hname: docs[i]._doc.hname,
                icon: docs[i]._doc.icon,
                link: docs[i]._doc.link,
                hakbun1: docs[i]._doc.hakbun1,
                name1: docs[i]._doc.name1,
                dept1: docs[i]._doc.dept1,
                grade1: docs[i]._doc.grade1,
                profile1: docs[i]._doc.profile1,
                hakbun2: docs[i]._doc.hakbun2,
                name2: docs[i]._doc.name2,
                dept2: docs[i]._doc.dept2,
                grade2: docs[i]._doc.grade2,
                profile2: docs[i]._doc.profile2,
              };
              array.push(data);
            }
            let context = {
              list: array,
              session: req.session,
              univ:univ
            };

            htmlrender(req, res, 'vote', context);
            return;
          }else{
            console.log('에러 발생.');
            //사용자 데이터 조회 안됨
            let context = {error:'기호 없음'};
            res.send(context);
            return;
          }
        });
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

app.post('/process/vote2/:univ', async (req, res) => {
  console.log('/process/vote2 라우팅 함수 호출됨.');

  let paramStdno = req.session.userid;  
  let univ = req.params.univ;
  
  if (database) {
    //사용자가 개인정보처리 동의했는지 체크 
    checkAgree(database, paramStdno, async function(err, docs) {
      if(err){
        console.log(err);
        console.log('에러 발생.');
        //에러발생
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }
      if(docs){ //사용자 확인 후  있음 result, 없음 error
        if(docs === {error: 'no user'}){
          console.log('('+paramStdno+')사용자가 개인정보처리에 동의하지 않았습니다.');
          res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'개인정보처리 약관에 동의하셔야 투표가 가능합니다.\');document.location.href=\'/sign\';</script>');
        }
        //단과대 선거id 찾기
        let year = new Date();
        console.log('세션 univ : ' + req.session.univ);
        let electId = await getElectIdByYearUniv(year.getFullYear(), univ);
        if(!electId){
          console.log('에러 발생.');
          let context = {error:req.session.univ+'선거가 존재하지 않음'};
          res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+context.error+'\');document.location.href=\'/main\';</script>');
          return;
        }
        let array = [];
        // election id 별로 candidate 구분 구현 시 하드코딩 해제 : i<2
        loadCandidateByElectId(database, electId, function(err, docs) {
          if(err){
            console.log('에러 발생.');
            let context = {error:'Error is occured'};
            res.send(context);
            return;
          }                      
          if(docs){
            for(let i=0; i<docs.length; i++){
              let data = {
                hakbun1: docs[i]._doc.hakbun1,
                hakbun2: docs[i]._doc.hakbun2,
                name1: docs[i]._doc.name1,
                name2: docs[i]._doc.name2,
                dept1: docs[i]._doc.dept1,
                dept2: docs[i]._doc.dept2,
                grade1: docs[i]._doc.grade1,
                grade2: docs[i]._doc.grade2,
                profile1: docs[i]._doc.profile1,
                profile2: docs[i]._doc.profile2,
                hname: docs[i]._doc.hname,
                icon: docs[i]._doc.icon,
                link: docs[i]._doc.link,
              };
              array.push(data);
            }
            let context = {
              list: array,
              session: req.session,
              electId: electId,
              univ:univ
            };
            htmlrender(req, res, 'vote2', context);            
            return;
          }else{
            console.log('에러 발생.');
            //사용자 데이터 조회 안됨
            let context = {error:'기호 없음'};
            res.send(context);
            return;
          }
        });
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

app.post('/process/finvote/:univ', async (req, res) => {
  console.log('/process/finvote 라우팅 함수 호출됨.');

  //[현재] "브릿지" 형식으로 넘어옴 (req.body.candidates)
  let paramballot = req.body.candidates;
  let userid = req.session.userid;
  let univ = req.params.univ;
  let electId = req.body.electId;
  let pw = ''; //pw from db

  if (database) {
    getHashPw(database, userid, async function(err, docs) {
      if(err){
        console.log('에러 발생.');
        //에러발생
        let context = {error:'Error is occured'};
        res.send(context);
        return;
      }
      if(docs){
        pw = docs;
        let useridpw = userid + pw;
        let walletid = crypto.createHash('sha256').update(useridpw).digest('base64');
        let picked = paramballot;

        // 블록체인에 투표 데이터 전송
        let networkObj = await network.connectToNetwork(walletid);
        let currentTime = new Date();
        let data = {
          walletid:walletid,
          electionId:electId,
          picked:picked,
          currentTime:currentTime,
          univ:univ
        };
        data = JSON.stringify(data);
        let args = [data];
        console.log(args);
        let response = await network.invoke(networkObj, false, 'castVote', args); //args = voterId, electionId, picked
        response = JSON.parse(response);
        if (response.error) {
          console.log(response.error);
          res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+response.error+'\');document.location.href=\'/main\';</script>');
          return;
        } else {
          console.log(response);
          res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'투표가 완료되었습니다. 다음 투표를 진행하시려면 투표하기를 눌러주십시오.\');document.location.href=\'/main\';</script>');
          return;
        }
      }else{
        console.log('에러 발생.');
        //사용자 데이터 조회 안됨
        let context = {error:'no user'};
        console.log(context);
        res.end('<head><meta charset=\'utf-8\'></head><script>document.location.href=\'/main\';</script>');
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

app.post('/process/login', async (req, res) => {
  console.log('/process/login 라우팅 함수 호출됨.');
      
  let paramStdno = req.body.voterId || req.query.voterId;
  let paramPassword = req.body.password || req.query.password;
  let hashPw = crypto.createHash('sha256').update(paramPassword).digest('base64');
  console.log('요청 파라미터 : ' + paramStdno + ', ' + hashPw);    
  
  if (paramStdno === 'admin'){ // if admin, 임시로 id가 admin일때로 고정(실제론 adminusers 컬렉션에서 admin id가 맞는지 확인해야함)
    if(database){
      authAdmin(database, paramStdno, hashPw, function(err, docs){
        if(err){
          console.log('에러 발생.');
          let context = {error:'Error is occured'};
          res.send(context);
          return;
        }
                    
        if(docs){
          console.log('look at this : ' + docs[0]);
          if(docs[0]._doc.pw === hashPw){
            //관리자 로그인 성공
            req.session.userid = paramStdno;
            req.session.univ = docs[0]._doc.univ;
            req.session.admin = 'Y'; //admin
            req.session.save();
            let context = {
              session: req.session
            };
            //registerUser(paramStdno);
            // wallet은 walletid로 등록
            let useridpw = paramStdno + hashPw;
            let walletid = crypto.createHash('sha256').update(useridpw).digest('base64');
            registerUser(walletid, 'admin', 'admin');
  
            htmlrender(req, res, 'adminMain', context);
            return;
          }else{
            res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'아이디 또는 비밀번호가 틀렸습니다.\');document.location.href=\'/login\';</script>');
            return;
          }
        }else{
          console.log('에러 발생.');
          //사용자 데이터 조회 안됨
          let context = {error:'no user'};
          console.log(context);
          res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'아이디 또는 비밀번호가 틀렸습니다.\');document.location.href=\'/login\';</script>');
          return;
        }
      });
    }else{
      console.log('에러 발생.');
      //데이터베이스 연결 안됨
      let context = {error:'Database is not connected'};
      res.send(context);
      return;    
    }
  }else{ // if not admin
    if (database) {
      authUser(database, paramStdno, hashPw, function(err, docs) {
        if(err){
          console.log('에러 발생.');
          //에러발생
          let context = {error:'Error is occured'};
          res.send(context);
          return;
        }
                    
        if(docs){
          if(docs[0]._doc.password === hashPw){
            if(docs[0]._doc.stat !== '재학'){
              res.send('<head><meta charset=\'utf-8\'></head><script>alert(\'재학중인 학생만 로그인 가능합니다.\');document.location.href=\'/login\';</script>');
              return;
            }
            //console.dir(docs);
            req.session.userid = paramStdno;
            req.session.univ = docs[0]._doc.univ;
            req.session.stat = docs[0]._doc.stat;
            req.session.save();
            //console.log(req.session.userid);
            //사용자 로그인 성공
            let context = {
              session: req.session
            };
            //registerUser(paramStdno);
            // wallet은 walletid로 등록
            let useridpw = paramStdno + hashPw;
            let walletid = crypto.createHash('sha256').update(useridpw).digest('base64');
            registerUser(walletid, 'user', req.session.univ);
  
            htmlrender(req, res, 'main', context);
            return;
          }else{
            res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'아이디 또는 비밀번호가 틀렸습니다.\');document.location.href=\'/login\';</script>');
            return;
          }
        }else{
          console.log('에러 발생.');
          //사용자 데이터 조회 안됨
          let context = {error:'no user'};
          console.log(context);
          res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'아이디 또는 비밀번호가 틀렸습니다.\');document.location.href=\'/login\';</script>');
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
  }
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
  let selected = req.query.selected || req.body.selected;
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'queryByObjectType', selected);
  let parsedResponse = await JSON.parse(response);
  res.send(parsedResponse);

});


//get voter info, create voter object, and update state with their voterId
app.post('/registerVoter', async (req, res) => {
  ////console.log('req.body: ');
  ////console.log(req.body);
  let voterId = req.body.voterId;
  req.body.univ = req.session.univ;
  console.log(voterId);
  //first create the identity for the voter and add to wallet
  let response = await network.registerVoter(voterId);
  console.log('response from registerVoter: ');
  console.log(response);
  if (response.error) {
    res.send(response.error);
  } else {
    console.log('req.body.voterId');
    console.log(req.body.voterId);
    let networkObj = await network.connectToNetwork(voterId);
    console.log('networkobj: ');
    console.log(networkObj);

    if (networkObj.error) {
      res.send(networkObj.error);
    }
    ////console.log('network obj');
    ////console.log(util.inspect(networkObj));

    let year = new Date();
    req.body.year = String(year.getFullYear());
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
  res.writeHead(404, {'Content-Type':'text/html;charset=utf-8'});
  res.write('<script>setTimeout(function(){document.location.href=\'/\';},3000);</script>');
  res.end('<h1>요청하신 페이지는 없어용.');
  //res.status(404).send('<h1>요청하신 페이지는 없어용.');
});

app.listen(process.env.PORT || 8081, function(){
  console.log('server is running : '+8081);

  //DB연결
  connectDB();
});