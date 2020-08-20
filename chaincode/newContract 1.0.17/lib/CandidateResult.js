/* eslint-disable indent */
'use strict';

class CandidateResult {

    /**

   * @param votableId - the Id of the votableItem
   * @param description - the description of the votableItem
   * @param voterId - the unique Id which corresponds to a registered voter
   * @returns - registrar object
   * 
   * args{"name" : "브릿지",              
"icon" : "f4838e2722.png",    
"link" : "https://www.smu.ac.ktachNo=482266",
"hakbun1" : 17,               
"name1" : "박수민",              
"dept1" : "컴퓨터과학과",           
"grade1" : 4,                 
"profile1" : "bb6d86fba7.png",
"hakbun2" : 18,               
"name2" : "박신혜",              
"dept2" : "신문방송학과",           
"grade2" : 3,                 
"profile2" : "d39dd2582c.png"
}
   * 
   * 
   * 
   */
  constructor( name, electionId ,icon ,link,hakbun1,name1 , dept1 ,  grade1,  profile1 ,hakbun2 , name2 ,    dept2  ,  grade2 , profile2 ) {
    this.candidateId =  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.name = name;
    this.electionId = electionId;
    this.count = 0;
    this.icon=icon;
    this.link=link;
    this.hakbun1= hakbun1;
    this.name1=name1;
    this.dept1=dept1;
    this.grade1=grade1;
    this.profile1=profile1;
    this.hakbun2=hakbun2;
    this.name2=name2;
    this.dept2 =dept2;
    this.grade2=grade2;
    this.profile2=profile2;

    this.type = 'candidateResult';
    return this;

  }
}
module.exports = CandidateResult;
