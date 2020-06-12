var express = require('express');
var http = require('http');

var app = express();

//express객체에 port 속성을 설정한다.
//시스템환경변수가 존재하지 않다면 3000번 사용
app.set('port', process.env.PORT || 3000);

//middleware
app.use(function(req, res, next) {
    console.log('첫번째 미들웨어 호출됨.');

    res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
    res.end('<h1>서버에서 응답한 결과입니다.</h1>');
})

//app.get 은 app.set으로 설정한 속성의 값을 가져오는 것
var server = http.createServer(app).listen(app.get('port'), function(){
    console.log('익스프레스로 웹 서버를 실행함 : ' + app.get('port'));

    
})
