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

const configPath = path.join(process.cwd(), './config.json');
const configJSON = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configJSON);

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
let UserModel;
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

    AdminSchema = mongoose.Schema({
      id: {type:String, required:true, unique:true},
      pw: {type:String, required:true},
      name: {type:String, index:'hashed'},
      email: {type:String, required:true},
    });
    console.log('AdminSchema 정의함.');
      
    UserSchema.static('findById', function(stdno, callback) {
      return this.find({stdno:stdno}, callback);        
    });

    UserSchema.static('findById2', function(stdno) {
      return this.find({stdno:stdno});        
    });
          
    UserSchema.static('findAll', function(callback){
      return this.find({}, callback);        
    });

    AdminSchema.static('findById', function(adminid, callback) {
      return this.find({id:adminid}, callback);        
    });

    AdminSchema.static('updateById', function(adminid, _email) {
      return this.update({id:adminid}, {$set : {email:_email}});
    });
  
    UserModel = mongoose.model('ssousers', UserSchema);
    console.log('UserModel 정의함.');

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
let getHashPw2 = async function(stdno) {
  console.log('getHashPw2 호출됨 : ' + stdno);
  let data = await UserModel.findById2(stdno);
  let useridpw = stdno + data[0].password;
  let walletid = crypto.createHash('sha256').update(useridpw).digest('hex');
  return walletid;
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

let registerUser = async function(walletId, gubun, univ){
  console.log('registerUser 호출됨');
  let response = await network.registerVoter(walletId);
  if (response.error) {
    console.log(response.error);
    let resp = {};
    resp.error = response.error;
    return resp;
  } else if(response.exists){
    let resp = {};
    resp.success = '이미 wallet에 등록되어있습니다.';
    return resp;
  }
  else {
    let resp = {};
    resp.success = '성공적으로 wallet에 등록되었습니다.';
    return resp;
  }
};

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
  let totalNum = 10; //재학생 수
  let deptNum = 0;
  //단과대별로 재학생 수 가져오기
  if(req.session.univ === '융합공과대학'){
    deptNum = 10;
  }else{
    deptNum = 10;
  }
  let arr = [];
  let networkObj = await network.connectToNetwork(appAdmin);
  let resElection = await network.invoke(networkObj, true, 'queryByObjectType', 'election');
  let parsedElection = await JSON.parse(resElection);
  parsedElection = await JSON.parse(parsedElection);
  
  let now = new Date();
  //선거 목록 출력 후 선거별로 투표율 계산 및 출력
  for (let i in parsedElection){
    let t1 = new Date(parsedElection[i].Record.startDate);
    let t2 = new Date(parsedElection[i].Record.endDate);
    if(now >= t1 && now <= t2){ 
      let args = {
        electionId: parsedElection[i].Key,
        totalNum: totalNum,
        deptNum: deptNum
      };
      networkObj = await network.connectToNetwork(appAdmin);
      let resp = await network.invoke(networkObj, false, 'queryCurrentTimeTurnout', args);
      resp = JSON.parse(resp);
      let avg = resp.success;
      avg = parseFloat(avg);
      if(resp.error){
        console.log('에러!');
        return;
      }else{
        arr.push({
          name: parsedElection[i].Record.name,
          enddate: parsedElection[i].Record.endDate.replace(/-/g, '.').substring(2, 10),
          avg: avg === 0 || avg === '0' ? avg : avg.toFixed(2),
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
  console.log('/myvote 호출됨');
  let userid = req.session.userid;
  let walletid = await getHashPw2(userid);
  let networkObj = await network.connectToNetwork(walletid);
  let response = await network.invoke(networkObj, true, 'checkMyVBallot', walletid);
  response = JSON.parse(response);
  let list = [];
  if (response.error) {
    let context = {
      session:req.session,
      list:list
    };
    htmlrender(req, res, 'myvote', context);
    return;
  }else{
    let elections = response.success;
    for(let i=0; i<elections.length; i++){
      let data = {
        election : elections[i].election,
        picked : elections[i].picked
      };
      list.push(data);
    }

    let context = {
      session:req.session,
      list:list
    };
    htmlrender(req, res, 'myvote', context);
    return;
  }
});
//모든 선거의 결과를 확인
app.get('/voteresult', async (req, res) => {
  console.log('/voteresult 호출됨');
  let totalNum = 20;  //임시로 총 학생 수, 단과대 학생수를 하드코딩함
  let deptNum = 10;
  let arr = [];

  let userid = req.session.userid;
  let walletid = await getHashPw2(userid);
  //블록체인으로부터 완료된 election과 투표율, 해당 CandidateResult과 투표율을 받아올 예정
  let networkObj = await network.connectToNetwork(walletid);
  let resElection = await network.invoke(networkObj, true, 'queryByObjectType', 'election');
  let parsedElection = await JSON.parse(JSON.parse(resElection));
  let date = new Date();    //기존엔 local의 시각으로 변경했으나 연산하는 과정이 많아져 생략
  // let date = new Date().toLocaleString();   //2020-8-15 4:52:22 PM

  //선거 종료 날짜 이전일 경우 조회 불가
  // if(date < checkdate){
  //   console.log('선거 결과 조회 기간이 아닙니다.');
  //   res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'선거 결과 조회 기간이 아닙니다. '+checkdate+'부터 \');document.location.href=\'/main\';</script>');
  //   return;
  // }

  //선거 종료 날짜 이전일 경우 조회되는 데이터 없도록 구현
  for (let i in parsedElection){
    let t1 = new Date(parsedElection[i].Record.startDate.substring(0,4));
    let year = date.getFullYear();
    let t2 = new Date(parsedElection[i].Record.endDate);
    let total;          //선거의 총 참여자 수
    let totalTurnout;   //선거의 총 투표율
    let candidateCount = []; //선거의 후보자 목록-투표한 학생 수 (배열)
    
    //선거 시작 날짜와 현재 시각의 연도만 비교 (선거는 1년마다 갱신되므로)
    if(year === t1 && date >= t2) {
      let electionId = parsedElection[i].Record.electionId;
      let res = await network.invoke(networkObj, false, 'queryCandidateResults', electionId);
      res = JSON.parse(res);
      total = res.count[0];     //선거의 총 참여자 수

      //선거의 투표율이 40%가 넘지 않았을 경우, 투표율 무산
      if(parsedElection[i].Record.univ === "총학생회") {
        totalTurnout = total/totalNum*100;
        if(totalTurnout < 40){
          console.log('('+ parsedElection[i].Record.name+') 해당 선거는 투표율 미달로 인해 무산되었습니다.');
        }
      } else {    //단과대 학생회 선거일 경우 deptNum 사용
        totalTurnout = res.count[0]/deptNum*100;
        if(totalTurnout < 40){
          console.log('('+ parsedElection[i].Record.name+') 해당 선거는 투표율 미달로 인해 무산되었습니다.');
        }
      }
      //각 후보자 별 투표율 계산해서 배열에 저장
      for (let a=0; a < res.count.length; a++) {
        if (a ==0){
          candidateCount[a] = totalTurnout;   //선거 총 투표율
        }
        candidateCount[a] = (res.count[a]/total)*100; //후보 별 투표율
      }

      arr.push({
        electionName: parsedElection[i].Record.name,    //선거 이름
        startDate: parsedElection[i].Record.startDate,  //선거 시작날짜
        endDate: parsedElection[i].Record.endDate,      //선거 종료날짜
        candidateName: res.name,   //배열형식, 첫번째 값은 voteNum, 선거운동본부 이름
        count: candidateCount  //배열형식, 첫번째 값만 해당 선거 투표율. 각 후보자 별 투표율
      });      
    }
  }  
  let context = {
    session: req.session,
    list: arr
  };  
  htmlrender(req, res, 'voteresult', context);
});
app.get('/sign', async (req, res) => {
  let univ = req.session.univ;
  let userid = req.session.userid;
  let stat = req.session.stat;
  let electId;
  let slots = ['slot1', 'slot2', 'slot3', 'slot4'];
  let i = 0;
  let pass = true;
  let electionCast;
  let election;

  if (stat !== '재학') {
    console.log(userid + ' 학생은 ' + stat +'상태 이므로 투표할 수 없습니다.');
    res.send('<head><meta charset=\'utf-8\'></head><script>alert(\'재학중인 학생만 투표가 가능합니다.\');document.location.href=\'/main\';</script>');
    return;
  }

  let walletid = await getHashPw2(userid);
  let networkObj = await network.connectToNetwork(walletid);
  let student = await network.invoke(networkObj, true, 'readMyAsset', walletid); //walletid만 넘기겠음
  student = JSON.parse(student);
  let year = new Date();
  electId = await getElectIdByYearUniv(year.getFullYear(), '총학생회');
  if(!electId){
    console.log('에러 발생.');
    let context = {error:'선거가 존재하지 않음'};
    res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+context.error+'\');document.location.href=\'/main\';</script>');
    return;
  }
  if(student.error){ //투표용지가 없는 경우 => 투표를 한 적이 없는 경우
    console.log('student error : ' + student.error);
    
    if(!electId){
      console.log('에러 발생.');
      let context = {error:'선거가 존재하지 않음'};
      res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+context.error+'\');document.location.href=\'/main\';</script>');
      return;
    }
    let args = {
      walletId: walletid,
      electionId: electId
    };
    let networkObj = await network.connectToNetwork(walletid);
    let response = await network.invoke(networkObj, false, 'createVBallot', args); //args = walletid
    response = JSON.parse(response);
    if(response.error){
      console.log(response.error);
      return;
    }
  }else{ //투표용지가 하나라도 만들어진 경우, slot1 이 NULL이 아닌 경우
    //총학생회 투표를 동의안함 했는지 체크하기
    let networkObj = await network.connectToNetwork(walletid);
    let electionCast = await network.invoke(networkObj, true, 'readMyAsset', student[slots[0]]);
    electionCast = JSON.parse(electionCast);
    if(electionCast.picked !== 'NULL'){ //투표했다면, 단과대 투표로 넘어가면됨.
      //투표해야됨.
      electId = await getElectIdByYearUniv(year.getFullYear(), req.session.univ);
      if(!electId){
        console.log('에러 발생.');
        let context = {error:'선거가 존재하지 않음'};
        res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+context.error+'\');document.location.href=\'/main\';</script>');
        return;
      }
      let args = {
        walletId: walletid,
        electionId: electId
      };
      let networkObj = await network.connectToNetwork(walletid);
      let response = await network.invoke(networkObj, false, 'createVBallot', args); //여기서 slot2가 생겨야함.
      response = JSON.parse(response);
      if(response.error){
        console.log(response.error);
        return;
      }
    }else { //투표안했다면, 바로 투표하러가기
      election = electionCast.election;
      pass = false;
    }
    
  }
  
  if(pass){
    // 투표용지 생성 이후 다시 자신의 slots들을 열어봄
    networkObj = await network.connectToNetwork(walletid);
    student = await network.invoke(networkObj, true, 'readMyAsset', walletid); //walletid만 넘기겠음
    student = JSON.parse(student);
    console.log('look at this');
    console.log(student);
    if(student.error){
      console.log('student error : ' + student.error);
      return;
    }
    
    // 목적: 투표를 하지 않은 VBallot을 찾는다(picked가 없음). 그 VBallot.election을 투표하도록 한다.
    // student[slots[i]] 를 readMyAsset 하면 VBallot이 나오고, 투표를 했는지 확인할 수 있다.
    // 투표했다면, i++ 투표를 하지 않았다면 break
    for(;i<slots.length; i++){
      if(student[slots[i]] !== 'NULL'){ //투표용지를 발급받았을 경우만
        networkObj = await network.connectToNetwork(walletid);
        electionCast = await network.invoke(networkObj, true, 'readMyAsset', student[slots[i]]);
        electionCast = JSON.parse(electionCast);
        if(electionCast.picked !== 'NULL'){ //이미 투표했다면
          continue;
        }else{ //투표용지를 발급받았지만, 투표를 하지 않았다면
          //해당 투표용지의 선거를 확인해서 투표를 할 수 있도록 한다.
          election = electionCast.election;
          break;
        }
      }
    }
  }
  
  //투표 기간이 되었는지 확인하기
  let curDate = new Date();
  let t1 = new Date(election.startDate);
  let t2 = new Date(election.endDate);
  if(curDate >= t1 && curDate <= t2){
    console.log(election.univ + ' 투표기간입니다.');
  }else{
    console.log(election.univ + ' 투표 기간이 아닙니다.');
    res.end('<head><meta charset=\'utf-8\'></head><script>alert('+election.univ+'\' 투표 기간이 아닙니다.\');document.location.href=\'/main\';</script>');
    return;
  }

  let context = {
    session:req.session,
    univ:election.univ
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
app.get('/castBallot/:electId', async (req, res) => {
  let userid = req.session.userid;
  let array = new Array();
  let context;
  let data;
  let electId = req.params.electId;
  if (database) {
    let walletid = getHashPw2(userid);
    let networkObj = await network.connectToNetwork(walletid);
    let candidate = await network.invoke(networkObj, true, 'getCandidateInfo', electId);
    candidate = JSON.parse(candidate);
    if(candidate.success){
      for(let i=0; i<candidate.success.length; i++){
        data = {
          no: i+1,
          hakbun1: candidate.success[i].Record.hakbun1,
          hakbun2: candidate.success[i].Record.hakbun2,
          name1: candidate.success[i].Record.name1,
          name2: candidate.success[i].Record.name2,
          dept1: candidate.success[i].Record.dept1,
          dept2: candidate.success[i].Record.dept2,
          grade1: candidate.success[i].Record.grade1,
          grade2: candidate.success[i].Record.grade2,
          profile1: candidate.success[i].Record.profile1,
          profile2: candidate.success[i].Record.profile2,
          hname: candidate.success[i].Record.name,
          icon: candidate.success[i].Record.icon,
          link: candidate.success[i].Record.link,
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
  }
});

app.get('/personalAgree', async (req, res) => {
  let context = {
    voterId:req.session.userid,
    session:req.session
  };
  htmlrender(req, res, 'personalAgree', context);
});

app.post('/process/removeElection', async(req,res) => {
  console.log('removeElection 호출됨');
  let electionid = req.body.electionid || req.query.electionid;
  console.log('electionid : '+ electionid);
  let args = {
    electionId : electionid
  };
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, true, 'getCandidateInfo', electionid);
  response = JSON.parse(response);
  if(response.success){
    for(let i=0; i<response.success.length; i++){
      if(response.success[i].Record.name !== '기권'){
        let filePath = path.join(__dirname + '/../public/img/' + response.success[i].Record.icon);
        fs.unlink(filePath, function(err){
          console.log(response.success[i].Record.icon + ' 파일 지워짐');
          //if (err) {console.log(err);}
        });
        filePath = path.join(__dirname + '/../public/img/' + response.success[i].Record.profile1);
        fs.unlink(filePath, function(err){
          console.log(response.success[i].Record.profile1 + ' 파일 지워짐');
          //if (err) {console.log(err);}
        });
        filePath = path.join(__dirname + '/../public/img/' + response.success[i].Record.profile2);
        fs.unlink(filePath, function(err){
          console.log(response.success[i].Record.profile2 + ' 파일 지워짐');
          //if (err) {console.log(err);}
        });
      }
    }
    networkObj = await network.connectToNetwork(appAdmin);
    let resp = await network.invoke(networkObj, false, 'deleteElection', args);
    resp = JSON.parse(resp);
    if(resp.success){
      console.log('선거가 삭제되었습니다.');
      resp = {};
      resp.success = '선거 정보가 삭제되었습니다.';
      res.send(resp);
    }else{
      console.log(resp.error);
      return;
    }
  }else{
    //선거가 존재하지 않을 때
    let response = {};
    response.error = '선거가 존재하지 않습니다.';
    res.send(response);
  }
});

app.post('/process/upload_image', upload2.array('image'), async(req,res) => {
  console.log('/process/upload_image 호출됨.');
});

app.post('/modifyvote', async (req, res) => {
  let electionid = req.body.electionid || req.query.electionid;
  console.log('modifyvote 호출됨.');
  console.log('electionid : ' + electionid);
  let array = [];
  let networkObj = await network.connectToNetwork(appAdmin);
  let election = await network.invoke(networkObj, true, 'readMyAsset', electionid);
  election = JSON.parse(election);
  networkObj = await network.connectToNetwork(appAdmin);
  let candidate = await network.invoke(networkObj, true, 'getCandidateInfo', electionid);
  candidate = JSON.parse(candidate);
  if(candidate.success){
    for(let i=0; i<candidate.success.length; i++){
      let data = {
        hname: candidate.success[i].Record.name,
        icon: candidate.success[i].Record.icon,
        link: candidate.success[i].Record.link,
        hakbun1: candidate.success[i].Record.hakbun1,
        name1: candidate.success[i].Record.name1,
        dept1: candidate.success[i].Record.dept1,
        grade1: candidate.success[i].Record.grade1,
        profile1: candidate.success[i].Record.profile1,
        hakbun2: candidate.success[i].Record.hakbun2,
        name2: candidate.success[i].Record.name2,
        dept2: candidate.success[i].Record.dept2,
        grade2: candidate.success[i].Record.grade2,
        profile2: candidate.success[i].Record.profile2,
      };
      array.push(data);
    }
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

app.post('/process/modifyvote', async (req, res) => {
  console.log('/process/modifyvote 라우팅 함수 호출됨.');
  console.log(req.files);
  
  // ledger에 등록된 선거 수정
  let len = req.body.isMulti;
  console.log('len = ' + len);
  let candidates = [];
  // DB에 선거 및 후보자 정보를 수정한다.
  if(len === 1){
    let data = {
      hname:req.body.hname,
      link:req.body.link,
      hakbun1:req.body.no1,
      name1:req.body.sname1,
      dept1:req.body.dept1,
      grade1:req.body.grade1,
      hakbun2:req.body.no2,
      name2:req.body.sname2,
      dept2:req.body.dept2,
      grade2:req.body.grade2,
    };
    candidates.push(data);
  }else{
    for(let i=0; i<len; i++){
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
      candidates.push(data);
    }
  }
  let args = {
    electionId: req.body.electionid,
    name: req.body.name,
    univ: req.body.univ,
    startdate: req.body.startdate,
    enddate: req.body.enddate,
    candidates: candidates
  };
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, false, 'modifyElection', args);
  response = JSON.parse(response);
  if (response.error) {
    console.log('modifyElection error : ' + response.error);
    res.send('<script>alert("오류가 발생하였습니다.");document.location.href="/adminMain";</script>');
    return;
  }
  console.log('modifyElection response : ' + typeof response + ' => ' + JSON.stringify(response));
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
  let arr = [];
  for(let i=0; i<len;i+=1){
    let data = {
      name: Array.isArray(req.body.hname) ? req.body.hname[i] : req.body.hname,
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
    arr.push(data);
  }
  let args = {
    name: req.body.name,
    univ: req.body.univ,
    startdate: req.body.startdate,
    enddate: req.body.enddate,
    candidates:arr
  };
  let networkObj = await network.connectToNetwork(appAdmin);
  let response = await network.invoke(networkObj, false, 'createElection', args);
  response = JSON.parse(response);
  if (response.error) {
    console.log('registervote error : ' + response.error);
    res.send('<script>alert("오류가 발생하였습니다.");document.location.href="/adminMain";</script>');
    return;
  } 
  console.log('createElection response : ' + typeof response + ' => ' + response);

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

app.post('/process/existagree/:univ', async (req, res) => {
  console.log('/process/existagree 라우팅 함수 호출됨.');

  let paramStdno = req.session.userid;
  let univ = req.params.univ;
  console.log('요청 파라미터 : ' + paramStdno);    
  
  let year = new Date();
  let electId = await getElectIdByYearUniv(year.getFullYear(), univ);
  if(!electId){
    console.log('에러 발생.');
    let context = {error:'투표할 선거가 존재하지 않음'};
    res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+context.error+'\');document.location.href=\'/main\';</script>');
    return;
  }
  let walletid = await getHashPw2(paramStdno);
  let array = [];
  let networkObj = await network.connectToNetwork(walletid);
  let ress = await network.invoke(networkObj, true, 'readMyAsset', electId);
  let election = JSON.parse(ress);
  networkObj = await network.connectToNetwork(walletid);
  let candidate = await network.invoke(networkObj, true, 'getCandidateInfo', electId);
  candidate = JSON.parse(candidate);
  if(candidate.success){
    let gigwon = '';
    for(let i=0; i<candidate.success.length; i++){
      if(candidate.success[i].Record.name === '기권'){
        gigwon = candidate.success[i].Record.candidateId;
        continue;
      }
      let data = {
        candidateId: candidate.success[i].Record.candidateId,
        electionid: candidate.success[i].Record.electionid,
        hname: candidate.success[i].Record.name,
        icon: candidate.success[i].Record.icon,
        link: candidate.success[i].Record.link,
        hakbun1: candidate.success[i].Record.hakbun1,
        name1: candidate.success[i].Record.name1,
        dept1: candidate.success[i].Record.dept1,
        grade1: candidate.success[i].Record.grade1,
        profile1: candidate.success[i].Record.profile1,
        hakbun2: candidate.success[i].Record.hakbun2,
        name2: candidate.success[i].Record.name2,
        dept2: candidate.success[i].Record.dept2,
        grade2: candidate.success[i].Record.grade2,
        profile2: candidate.success[i].Record.profile2,
      };
      array.push(data);
    }
    let context = {
      electionName: election.name,
      list: array,
      session: req.session,
      univ:univ,
      gigwon:gigwon
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

app.post('/process/vote2/:univ', async (req, res) => {
  console.log('/process/vote2 라우팅 함수 호출됨.');
  let univ = req.params.univ;
  
  //단과대 선거id 찾기
  let year = new Date();
  console.log('세션 univ : ' + req.session.univ);
  let electId = await getElectIdByYearUniv(year.getFullYear(), univ);
  if(!electId){
    console.log('에러 발생.');
    let context = {error:'선거가 존재하지 않음'};
    res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+context.error+'\');document.location.href=\'/main\';</script>');
    return;
  }
  let walletid = await getHashPw2(req.session.userid);
  let array = [];
  let networkObj = await network.connectToNetwork(walletid);
  let ress = await network.invoke(networkObj, true, 'readMyAsset', electId);
  let election = JSON.parse(ress);
  networkObj = await network.connectToNetwork(appAdmin);
  let candidate = await network.invoke(networkObj, true, 'getCandidateInfo', electId);
  candidate = JSON.parse(candidate);
  if(candidate.success){
    let gigwon = '';
    for(let i=0; i<candidate.success.length; i++){
      if(candidate.success[i].Record.name === '기권'){
        gigwon = candidate.success[i].Record.candidateId;
        continue;
      }
      let data = {
        candidateId: candidate.success[i].Record.candidateId,
        hakbun1: candidate.success[i].Record.hakbun1,
        hakbun2: candidate.success[i].Record.hakbun2,
        name1: candidate.success[i].Record.name1,
        name2: candidate.success[i].Record.name2,
        dept1: candidate.success[i].Record.dept1,
        dept2: candidate.success[i].Record.dept2,
        grade1: candidate.success[i].Record.grade1,
        grade2: candidate.success[i].Record.grade2,
        profile1: candidate.success[i].Record.profile1,
        profile2: candidate.success[i].Record.profile2,
        hname: candidate.success[i].Record.name,
        icon: candidate.success[i].Record.icon,
        link: candidate.success[i].Record.link,
      };
      array.push(data);
    }
    let context = {
      electionName: election.name,
      list: array,
      session: req.session,
      electId: electId,
      univ:univ,
      gigwon:gigwon
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

app.post('/process/finvote/:univ', async (req, res) => {
  console.log('/process/finvote 라우팅 함수 호출됨.');

  //[현재] "브릿지" 형식으로 넘어옴 (req.body.candidates)
  //[수정] "asdfjkaefafjel" 또는 ["saejglkaekgja", "awjkegjka;ke"] 형식으로 넘어와야함.
  let paramballot = req.body.candidates;
  let univ = req.params.univ;
  let userid = req.session.userid;
  let walletid = await getHashPw2(userid);
  let candidateid = paramballot;

  // 블록체인에 투표 데이터 전송
  let args = {
    walletId:walletid,
    candidateId:candidateid,
    univ:univ
  };
  console.log('args : ' + JSON.stringify(args));
  let networkObj = await network.connectToNetwork(walletid);
  let response = await network.invoke(networkObj, false, 'castVote', args); 
  response = JSON.parse(response);
  console.log(JSON.stringify(response));
  if (response.error) {
    console.log(response.error);
    res.end('<head><meta charset=\'utf-8\'></head><script>alert(\''+response.error+'\');document.location.href=\'/main\';</script>');
    return;
  } else {
    console.log(response);
    res.end('<head><meta charset=\'utf-8\'></head><script>alert(\'투표가 완료되었습니다. 다음 투표를 진행하시려면 투표하기를 다시 눌러주십시오.\');document.location.href=\'/main\';</script>');
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
      authAdmin(database, paramStdno, hashPw, async function(err, docs){
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
            // wallet은 walletid로 등록
            let useridpw = paramStdno + hashPw;
            let walletid = crypto.createHash('sha256').update(useridpw).digest('hex');
            let response = await registerUser(walletid, 'admin', 'admin');
            if(response.error){
              console.log(response.error);
              req.session.destroy(function(){
                req.session;
              });
              res.send('<head><meta charset=\'utf-8\'></head><script>alert('+response.error+');document.location.href=\'/login\';</script>');
              return;
            }
            if(response.success){
              console.log(response.success);
            }
  
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
      authUser(database, paramStdno, hashPw, async function(err, docs) {
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
            req.session.stat = docs[0]._doc.stat;
            req.session.save();
            //console.log(req.session.userid);
            //사용자 로그인 성공
            let context = {
              session: req.session
            };
            // wallet은 walletid로 등록
            let useridpw = paramStdno + hashPw;
            let walletid = crypto.createHash('sha256').update(useridpw).digest('hex');
            let response = await registerUser(walletid, 'user', req.session.univ);
            if(response.error){
              console.log(response.error);
              req.session.destroy(function(){
                req.session;
              });
              res.send('<head><meta charset=\'utf-8\'></head><script>alert('+response.error+');document.location.href=\'/login\';</script>');
              return;
            }
            if(response.success){
              console.log(response.success);
            }
  
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