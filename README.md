# evote-project
Capstone Design - evote hyperledger fabric project

# 사용법(요약)
1. 현재 경로에서 git bash 를 켠다.
2. cd network/ 한다. (network 폴더로 이동)
3. bash shut.sh (docker 종료 및 폴더 삭제 등)
4. bash start.sh (인증서/지갑 생성 및 docker 구동)
5. cd ../server/ 한다. (server 폴더로 이동)
6. node src/app 한다. (웹서버 구동)
7. http://localhost:8081 웹 브라우저로 접속 (node webserver 접속)
8. http://localhost:5984/_utils 웹 브라우저로 접속 (couchdb0 확인, couchdb1은 6984 포트임)
9. 각 노드별로 로그 확인은 알아서 하길 바람. (docker console/GUI 이용바람)

# 참고사항
1. 실행은 git bash 를 사용하길 바람.
2. docker desktop은 file sharing에 network 폴더를 등록해두길 바람.
3. 기타 궁금한 사항은 담당자에게 물어보기 바람.
4. bin 폴더 내용물은 크ꈰ가 너무 커서 github에는 올리지 않음.
