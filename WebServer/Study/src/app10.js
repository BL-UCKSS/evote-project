var express = require('express')
,http = require('http')
,path = require('path');

var bodyParser = require('body-parser') //추가 설치 필요
,static = require('serve-static')
,cookieParser = require('cookie-parser')
,expressSession = require('express-session')

// 에러 핸들러 모듈 사용
var expressErrorHandler = require('express-error-handler');

// 암호화 모듈
var crypto = require('crypto');

// mongoose 모듈 사용
var mongoose = require('mongoose');

var database;
var UserSchema;
var UserModel

function connectDB() {
    var databaseUrl = 'mongodb://localhost:27017/local';
    
    mongoose.Promise = global.Promise;
    mongoose.connect(databaseUrl);
    database = mongoose.connection;
    
    database.on('open', function() {
        console.log('데이터베이스에 연결됨 : ' + databaseUrl);
        
            
        UserSchema = mongoose.Schema({
            id: {type:String, required:true, unique:true,'default':''},
            hashed_password: {type:String, required:true,'default':''},
            salt:{type:String,required:true},
            name: {type:String, index:'hashed','default':''},
            age: {type:Number, 'default':-1},
            created_at: {type:Date,index:{unique:false},'default':Date.now()},
            updated_at:{type:Date,index:{unique:false},'default':Date.now()}
        });
        console.log('UserSchema 정의함.');
        
        UserSchema
            .virtual('password')
            .set(function(password) {
                this.salt = this.makeSalt();
                this.hashed_password = this.encryptPassword(password);
                console.log('virtual password 저장됨 : ' + this.hashed_pasword);
            })
            //.get()
            
        UserSchema.method('encryptPassword', function(plainText, inSalt){
            if(inSalt){
                return crypto.createHmac('sha1',inSalt).update(plainText).digest('hex');
            } else {
                return crypto.createHmac('sha1', this.salt).update(plainText).digest('hex');
            }
        })
        
        UserSchema.method('makeSalt', function() {
            return Math.round((new Date().valueOf() * Math.random())) + '';
        });
        
        UserSchema.method('authenticate', function(plainText,inSalt,hashed_password) {
            if(inSalt) //salt가 넘어온 경우
            {
                console.log('authenticate 호출됨.');
                return this.encryptPassword(plainText, inSalt) === hashed_password;
            } else {
                console.log('authenticate 호출됨.');
                return this.encryptPassword(plainText) === hashed_password;
            }
        })
            
        //함수 등록(이후 모델 객체에서 사용가능)
        UserSchema.static('findById', function(id, callback) {
            return this.find({id:id}, callback);        
        });
            
        /*UserSchema.statics.findById = function(id, callback) {
            return this.find({id:id}, callback);
        }*/
            
        UserSchema.static('findAll', function(callback){
            return this.find({}, callback);        
        })
            
        UserModel = mongoose.model('users3', UserSchema);
        console.log('UserModel 정의함.');
        
    });
    
    database.on('disconnected', function(){
        console.log('데이터베이스 연결 끊어짐.');    
    })
    
    database.on('error', console.error.bind(console, 'mongoose 연결 에러.'));
}

var app = express();

app.set('port', process.env.PORT || 3000);
app.use('/public', static(path.join(__dirname, 'public'))); //middleware

//외장 모듈 미들웨어 등록(body로 들어가는 파라미터를 처리하기 위함)
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

app.use(cookieParser());
app.use(expressSession({
    secret:'my key',
    resave:true,
    saveUninitialized:true
}));



var router = express.Router();

router.route('/process/adduser').post(function(req,res){
    console.log('/process/adduser 라우팅 함수 호출됨.');
    var paramId=req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    var paramName = req.body.name || req.query.name;
        
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword + ', '+paramName);
    if(database) {
        addUser(database, paramId, paramPassword, paramName, function(err, result){
            if(err) throw err;
            if(result){
                console.dir(result);
                res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
                res.write('<h1>사용자 추가 성공</h1>');
                res.write('<div><p>사용자 : ' + paramName + '</p></div>');
                res.write('<br><br><a href="/public/login.html">다시 로그인하기</a>');
                res.end();
            } else {
                console.log('에러 발생');
                res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
                res.write('<h1>사용자 추가 안됨</h1>');
                res.end();    
            }
        });
    }else {
        console.log('에러 발생.');
        res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
        res.write('<h1>데이터베이스 연결 안됨.</h1>');
        res.end();
        return;  
    }   
})

router.route('/process/login').post(function(req,res){
    console.log('/process/login 라우팅 함수 호출됨.');
        
    var paramId = req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword);    
    
    if (database) {
        authUser(database, paramId, paramPassword, function(err, docs) {
            if(err){
                console.log('에러 발생.');
                res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
                res.write('<h1>에러 발생</h1>');
                res.end();
                return;
            }
                    
            if(docs){
                console.dir(docs);
                res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
                res.write('<h1>사용자 로그인 성공</h1>');
                res.write('<div><p>사용자 : ' + docs[0].name + '</p></div>')
                res.write('<br><br><a href="/public/login.html">다시 로그인하기</a>');
                res.end();
                return;
            }else{
                console.log('에러 발생.');
                res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
                res.write('<h1>사용자 데이터 조회 안됨.</h1>');
                res.end();
                return;
            }
        })    
    }else {
        console.log('에러 발생.');
        res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
        res.write('<h1>데이터베이스 연결 안됨.</h1>');
        res.end();
        return;    
    }
})

router.route('/process/listuser').get(function(req,res){
    console.log('/process/listuser 라우팅 함수 호출됨.');
    if(database) {
        UserModel.findAll(function(err, results){
            if(err){
                console.log('에러 발생.');
                res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
                res.write('<h1>사용자 데이터 조회 안됨.</h1>');
                res.end();
                return;
            }
            if(results){
                console.dir(results);
                res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
                res.write("<h3>사용자 리스트</h3>");
                res.write("<div><ul>");
                for(var i=0; i<results.length; i++){
                    var curId = results[i]._doc.id;
                    var curName = results[i]._doc.name;
                    res.write("    <li>#" + i + "-> " + curId + ", " + curName +
                             "</li>");
                }
                res.write("</ul></div>");
                res.end();
            }else {
                console.log('에러 발생.');
                res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
                res.write('<h1>조회된 사용자 없음.</h1>');
                res.end();
                return;
            }
        })
    }else{
        console.log('에러 발생.');
        res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
        res.write('<h1>데이터베이스 연결안됨.</h1>');
        res.end();
        return;
    }
})

app.use('/', router);

var authUser = function(database, id, password, callback) {
    console.log('authUser 호출됨 : ' + id + ', ' + password);
    
    UserModel.findById(id, function(err, result) {
        if(err) {
            callback(err, null);
            return;
        }
        console.log('아이디 %s로 검색됨.');
        if(result.length > 0){
            var user = new UserModel({id:id})
            var authenticated = user.authenticate(password, result[0],_doc.salt, result[0]._doc.hashed_password);
                
            if(authenticated) {
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
    
}

var addUser = function(database, id, password, name, callback) {
    console.log('addUuser 호출됨 : ' + id + ', ' + password + ', '+ name);
    
    var user = new UserModel({"id":id,"password":password,"name":name});
    
    user.save(function(err) {
        if(err) {
            callback(err, null);
            return;
        }
        console.log('사용자 데이터 추가함.');
        callback(null, user);
    });
}

// 404 에러 페이지 처리
var errorHandler = expressErrorHandler({
    static: {
        '404': './public/404.html'
    }
});

app.use( expressErrorHandler.httpError(404) );
app.use( errorHandler );

//app.get 은 app.set으로 설정한 속성의 값을 가져오는 것
var server = http.createServer(app).listen(app.get('port'), function(){
    console.log('익스프레스로 웹 서버를 실행함 : ' + app.get('port'));
    
    //서버 실행되고 나서 데이터베이스 실행한다. (데이터베이스 먼저 실행해도 됨)
    connectDB();
})