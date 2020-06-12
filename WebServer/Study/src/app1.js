//모듈 가져오기
var http = require('http');

//웹 서버 객체 생성
var server = http.createServer();

//호스트 IP주소
var host = 'localhost';
//포트 번호 3000번
var port = 3000;
//3000번으로 port listening(클라이언트로부터 요청을 대기)
//50000는 동시접속자 가능 수(백로그)
server.listen(port, host, 50000, function(){
    console.log("웹서버가 실행되었습니다 -> " + host + ':' + port);
})

//http://localhost:3000 으로 접속하면
//무한 루프가 동작된다.
//왜냐하면 응답으로 주어진 것이 없어임.

//이벤트 connection이 들어오면 어떤 동작을 함.
//보통 client가 서버에 접속하면 이벤트 발생함
server.on('connection', function(socket) {
    console.log('클라이언트가 접속했음');
})

server.on('request', function(req, res) {
    console.log('클라이언트 요청옴.');
    //req 객체 구조 출력
    //console.dir(req);

    //응답으로 보낼 헤더 작성
    //res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
    //응답 본문(body) 데이터를 만듬. 여러번 호출 가능.
    //res.write('<h1>웹서버로부터 받음</h1>');
    //클라이언트로 응답 전송
    //res.end();

    //이미지만 출력하기
    //var filename = 'house.png';
    //fs.readFile(filename, function(err,data) {
    //	res.writeHead(200, {"Content-Type":"image/png"});
    //	res.write(data);
    //	res.end();
    //});

    
});
