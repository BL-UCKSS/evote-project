var express = require('express');
var http = require('http');

var app = express();

//express객체에 port 속성을 설정한다.
//시스템환경변수가 존재하지 않다면 3000번 사용
app.set('port', process.env.PORT || 3000);

//middleware
app.use(function(req, res, next) {
    console.log('첫번째 미들웨어 호출됨.');

    req.user = 'mike';
        
    next();
    //res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
    //res.end('<h1>서버에서 응답한 결과입니다.</h1>');
})

app.use('/', function(req, res, next) {
    console.log("두번째 미들웨어 호출됨.");
    
    //첫번째 미들웨어에서 생성한 req.user을 두번째에서 받아서 사용가능
    //res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
    //res.end('<h1>서버에서 응답한 결과입니다.: '+req.user+'</h1>');
    
    //send를 사용하여 writeHead, end를 생략할 수 있다.
    //res.send('<h1>서버에서 응답한 결과입니다.: '+req.user+'</h1>')
        
    //send할 때 객체를 넣기.
    var person = {name:'소녀시대',age:20};
    //res.send(person);
        
    //JSON.stringify를 이용한 JSON 문자열로 출력
    var personStr = JSON.stringify(person);
    //res.send(personStr);
        
    res.writeHead(200, {"Content-Type":"application/json;charset=utf8"});
    res.write(personStr);
    res.end();
})

//app.get 은 app.set으로 설정한 속성의 값을 가져오는 것
var server = http.createServer(app).listen(app.get('port'), function(){
    console.log('익스프레스로 웹 서버를 실행함 : ' + app.get('port'));

    
})