var express = require('express')
,http = require('http')
,path = require('path');

var bodyParser = require('body-parser') //추가 설치 필요
,static = require('serve-static')
,cookieParser = require('cookie-parser')
,expressSession = require('express-session')

// 에러 핸들러 모듈 사용
var expressErrorHandler = require('express-error-handler');

var user = require('./routes/user');

var config = require('./config');

var database_loader = require('./database/database_loader');
var route_loader = require('./routes/route_loader');

// 암호화 모듈
var crypto = require('crypto');

// mongoose 모듈 사용
var mongoose = require('mongoose');

var database;

function connectDB() {
    //
    app.set('database', database);
}

function createUserSchema(database) {
    //database의 속성으로 넣어주기.
    database.UserSchema = require('./database/user_schema').createSchema(mongoose);
    
    database.UserModel = mongoose.model('users3', database.UserSchema);
    console.log('UserModel 정의함.');
}

var app = express();

console.log('config.server_port -> ' + config.server_port);
app.set('port', config.server_port || 3000);
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

route_loader.init(app, express.Router());

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
    database_loader.init(app, config);
})