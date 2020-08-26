/* eslint-disable no-var */
/* eslint-disable eqeqeq */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable indent */
/* eslint-disable strict */
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