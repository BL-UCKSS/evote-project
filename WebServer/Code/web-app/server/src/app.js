/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable no-tabs */
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
const crypto = require('crypto');
const multer = require('multer');

// sso user login 세션 관리용
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');

let network = require('./fabric/network.js');

// mongoose 모듈 사용
let mongoose = require('mongoose');
//파일 이름은 겹칠 수 있으므로, 후에 electionid와 함께 사용
const storage = multer.diskStorage({
  destination : (req, file, cb) => {
    cb(null, 'public/img/');
  },
  filename : (req, file, cb) => {
    let name = req.body.name;
    cb(null, name + '_' + file.originalname);
  }
});
const upload = multer({storage: storage});

let database;
let UserSchema;
let PersonalAgreeSchema;
let CandidateSchema;
let UserModel;
let PersonalAgreeModel;
let CandidateModel;
let AdminSchema;
let AdminModel;

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
      electionid: {type:String, required:true, unique:true},
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
//임시로 ibm-evote의 선거 코드를 가져오는 함수
let getElectId = async function(){
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'queryByObjectType', 'election');
  let res = JSON.parse(JSON.parse(response));
  let electId = res[0].Key;
  return electId;
};

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
  let t = new Date();
  let total = 12; //재학생 수
  let arr = [];
  let networkObj = await network.connectToNetwork(appAdmin);
  let resVoter = await network.invoke(networkObj, true, 'queryByObjectType', 'voter');
  let parsedVoter = await JSON.parse(resVoter);
  parsedVoter = await JSON.parse(parsedVoter);

  let resElection = await network.invoke(networkObj, true, 'queryByObjectType', 'election');
  let parsedElection = await JSON.parse(resElection);
  parsedElection = await JSON.parse(parsedElection);
  
  //선거 목록 출력 후 선거별로 투표율 계산 및 출력
  for (let i in parsedElection){
    let count = 0;
    //type으로는 총학생회 투표나 각 단과대 투표로 구분하는 걸 가정
    if(parsedElection[i] && parsedElection[i].Record.year === t.getFullYear() && parsedElection[i].Record.type === 'election'){ //'chonghak', 'yoongongdae'
      //해당 선거의 투표율을 확인해야하지만, 현재 querybyobjecttype voter는 type을 구분할 수 없음.
      for (let j in parsedVoter){
        if(parsedVoter[j].Record.ballotCast){
        //if(parsedVoter[j].Record.ballotType === parsedVoter[i].Record.type) //이런식으로 구분할 수 있겠음.
          count += 1;
        }
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
  //console.log(list);
  let context = {
    session:req.session,
    list:list
  };
  htmlrender(req, res, 'adminManage', context);
});

app.post('/process/startElection', async(req,res) => {
  console.log('startElection 호출됨');
  let electionid = req.body.electionid || req.query.electionid;
  console.log('electionid : '+ electionid);
  /*let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'startElection', electionid);
  let context = JSON.parse(JSON.parse(response));
  res.send(context);*/
  res.send(true); // 임시로 무조건 시작 성공하게 만듦.
});

app.post('/process/endElection', async(req,res) => {
  console.log('endElection 호출됨');
  let electionid = req.body.electionid || req.query.electionid;
  console.log('electionid : '+ electionid);
  /*let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'endElection', electionid);
  let context = JSON.parse(JSON.parse(response));
  res.send(context);*/
  res.send(true); // 임시로 무조건 시작 성공하게 만듦.
});

app.post('/process/removeElection', async(req,res) => {
  console.log('removeElection 호출됨');
  let electionid = req.body.electionid || req.query.electionid;
  console.log('electionid : '+ electionid);
  /*let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'removeElection', electionid);
  let context = JSON.parse(JSON.parse(response));
  res.send(context);*/
  res.send(true); // 임시로 무조건 시작 성공하게 만듦.
});

app.post('/modifyvote', async (req, res) => {
  let electionid = req.body.electionid || req.query.electionid;
  console.log(electionid);
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'queryByObjectType', 'election');
  let list = JSON.parse(JSON.parse(response));
  //console.log(list);
  let context = {
    session:req.session,
    list:list
  };
  htmlrender(req, res, 'modifyvote', context);
});

app.post('/process/modifyvote', async (req, res) => {
  console.log('/process/modifyvote 라우팅 함수 호출됨.');
  // ledger에 등록된 선거 수정
  /*let args = {
    startdate: req.body.startdate,
    enddate: req.body.enddate
  };
  let response = await network.invoke(networkObj, false, 'modifyElection', args);
  if (response.error) {
    res.send(response.error);
  } else {
    res.send(response);
  }*/
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'adminMain', context);
});

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

app.get('/myvote', async (req, res) => {
  let userid = req.session.userid;
  let pw = ''; //pw from db
  if (database) {
    getHashPw(database, userid, function(err, docs) {
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
        //임시로 출력
        res.end('<p>userid : '+userid+'</p><p>pw : '+pw+'</p><p>useridpw : '+useridpw+'</p><p>walletid : '+walletid+'</p>');
        // 아직 queryByWalletId 컨트랙이 완성되지 않음.
        /*
        let networkObj = await network.connectToNetwork(appAdmin);
        let response = await network.invoke(networkObj, true, 'queryByWalletid', walletid); //walletid만 넘기겠음
        response = JSON.parse(response);
        if (response.error) {
          res.send(response.error);
        } else {
          res.send(response);
        }
        let context = {
          session:req.session,
          list:response
        };
        */
        //htmlrender(req, res, 'myvote', context);
      }else{
        console.log('에러 발생.');
        //사용자 데이터 조회 안됨
        let context = {error:'no user'};
        console.log(context);
        res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'에러!\');document.location.href=\'/main\';</script>');
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
  let context = {
    session:req.session
  };
  htmlrender(req, res, 'sign', context);
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

let registerCandidate = async function(database, data) {
  console.log('registerCandidate 호출됨');
  await CandidateModel.registerCandidate(data);
};

app.post('/process/registervote', upload.array('image'), async (req, res) => {
  // ledger에 선거 등록
  // electionid 같은 경우엔 체인코드에서 처리해도됨
  /*let args = {
    electionid: 0,
    name: req.body.name,
    startdate: req.body.startdate,
    enddate: req.body.enddate
  };
  let response = await network.invoke(networkObj, false, 'createElection', args);
  if (response.error) {
    res.send(response.error);
  } else {
    res.send(response);
  }*/
  // DB에 저장한다.
  if(database){
    // DB에 req.body의 값들을 삽입한다.
    // electionId의 경우 getElectId()를 임시적으로 사용한다.
    let electionId = await getElectId();
    let len = req.body.no.length;
    for(let i=0; i<len;i+=2){
      let j = i + 1;
      let data = {
        electionid:electionId,
        hname:req.body.hname,
        icon:req.files[0].filename,
        link:req.body.link,
        hakbun1:req.body.no[i],
        name1:req.body.sname[i],
        dept1:req.body.dept[i],
        grade1:req.body.grade[i],
        profile1:req.files[j].filename,
        hakbun2:req.body.no[i+1],
        name2:req.body.sname[i+1],
        dept2:req.body.dept[i+1],
        grade2:req.body.grade[i+1],
        profile2:req.files[j+1].filename,
      };
      registerCandidate(database, data);
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

app.post('/help', async (req, res) => {
  let email = req.body.email || req.query.email;
  await updateAdminEmail(database, 'admin', email);
  let context = {
    session:req.session,
    email:email
  };
  htmlrender(req, res, 'suggestion', context);
});

app.get('/logout', async (req, res) => {
  req.session.destroy(function(){
    req.session;
  });
  res.redirect('/login');
});

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

app.post('/process/existagree', async (req, res) => {
  console.log('/process/existagree 라우팅 함수 호출됨.');

  let paramStdno = req.session.userid;
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
        //총학생회 선거 if(year == Date.now() && gubun == "chonghak") 일 때 첫번째로 출력됨.
        let electId = await getElectId(); //임시로 하드코딩함.
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
              session: req.session
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

app.post('/process/vote2', async (req, res) => {
  console.log('/process/vote2 라우팅 함수 호출됨.');

  let paramStdno = req.session.userid;  
  
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
        let electId = await getElectId(); //임시로 하드코딩함.
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
                no: docs[i]._doc.no,
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
              session: req.session
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

app.post('/process/finvote', async (req, res) => {
  console.log('/process/finvote 라우팅 함수 호출됨.');

  //[현재] "기호 1번 브릿지" 형식으로 넘어옴 (req.body.candidates)
  //받아오고 난 후에는 블록체인 네트워크에 실어야 함
  let paramballot = req.body.candidates;
  let userid = req.session.userid;
  //let univ = req.session.univ;
  let pw = ''; //pw from db

  // console.log(paramballot);

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
        let electId = await getElectId();
        let picked = paramballot;


        // 사용자에게 한 번 더 묻기 (수정해야 함)
        // res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'정말 투표하시겠습니까?\');document.location.href=\'/finvote\';</script>');

        // 블록체인에 투표 데이터 전송해야 함
        // saveBallot(walletid, electionid, paramballot)
        let networkObj = await network.connectToNetwork(walletid);
        let data = {
          voterId:walletid,
          electionId:electId,
          picked:picked
        };
        data = JSON.stringify(data);
        let args = [data];

        let response = await network.invoke(networkObj, false, 'castVote', args); //args = voterId, electionId, picked
        if (response.error) {
          res.send(response.error);
        } else {
          res.send(response);
        }
      }else{
        console.log('에러 발생.');
        //사용자 데이터 조회 안됨
        let context = {error:'no user'};
        console.log(context);
        res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'에러!\');document.location.href=\'/main\';</script>');
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
  //{ candidates: '브릿지' } 형식으로 넘어옴 (req.body)


  //let electId = await getElectId(); //임시로 하드코딩함.
  //let array = [];

});

async function registerUser(walletId, gubun){
  let response = await network.registerVoter(walletId);
  if (response.error) {
	    // eslint-disable-next-line no-mixed-spaces-and-tabs
	    console.log(response.error);
  } else {
	    let networkObj = await network.connectToNetwork(walletId);
	    if (networkObj.error) {
	        console.log(networkObj.error);
	    }
	    let argument = JSON.stringify({voterId:walletId, registrarId:walletId, firstName:'no', lastName:'no'});
	    let args = [argument];
    //connect to network and update the state with voterId
    let invokeResponse;
    if (gubun === 'user'){
	      invokeResponse = await network.invoke(networkObj, false, 'createVoter', args);
    }else if(gubun === 'admin'){
      //invokeResponse = await network.invoke(networkObj, false, 'createAdmin', args);
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
    }
  }
}

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
            registerUser(walletid, 'admin');
  
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
            //console.dir(docs);
            req.session.userid = paramStdno;
            req.session.univ = docs[0]._doc.univ;
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
            registerUser(walletid, 'user');
  
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