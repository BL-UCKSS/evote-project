/* eslint-disable no-var */
/* eslint-disable eqeqeq */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable indent */
/* eslint-disable strict */
//adminMain
var noElection = function (option) {
    if (option === 'manage') { //선거 관리하기
        document.location.href = '/adminManage';
    } else if (option === 'count') { //투표율 확인
        document.location.href = '/adminNow';
    } else { //투표가 하나라도 개설되지 않았을 경우 팝업
        $('#noElectionModal').modal('toggle');
    }
}
//adminManage
var changeTitle = function(modal, title, electionid){
    $('#'+modal).modal('toggle');
    $('#'+modal+' #modalTitle').text(title);
    $('.modal #modalTitle').text(title);
    $('#'+modal+' #modalElectId').text(electionid);
    $('.modal #modalElectId').text(electionid);
};
var hideToggle = function(hide, toggle){
    $('#'+hide).modal('hide');
    $('#'+toggle).modal('toggle');
};
var goUrl = function(url){
    document.location.href=url;
};
function getFormatDate(date, num){
    var year = date.getFullYear();              //yyyy
    var month = (1 + date.getMonth());          //M
    month = month >= 10 ? month : '0' + month;  //month 두자리로 저장
    var day = date.getDate() + num;                   //d
    day = day >= 10 ? day : '0' + day;          //day 두자리로 저장
    return  year + '-' + month + '-' + day;       //'-' 추가하여 yyyy-mm-dd 형태 생성 가능
}