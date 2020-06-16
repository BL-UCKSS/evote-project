'use strict';


class Voter {
  /**
   *
   * Voter
   *
   * Constructor for a Voter object. Voter has a voterId and registrar that the
   * voter is . 유권자 식별을 위한 객체
   *
   * @param items - an array of choices
   * @param election - what election you are making ballots for
   * @param voterId - the unique Id which corresponds to a registered voter
   * @returns - registrar object
   */
   //복사 완료
   async init(studentId, studentPW) {
     //return(async () => {
     this.student = await this.validateStudentId(studentId, studentPW)
     if (this.student!== false) {
       this.voterId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
       this.department  = this.student
       //this.name = student.name;
       this.ballotCreated = false;
       this.type = 'voter';
       if (this.__isContract) {
         delete this.__isContract;
       }
       if (this.student) {
         delete this.student;
       }
       return this;

     } else if (student){
       throw new Error('학번 또는 비밀번호가 다릅니다.');
     } else {
       throw new Error('예상외의 오류');
    }
     //return의 끝
    //})
   }

   /**
    *
    * validateVoter
    *
    * check for valid ID card - stateID or drivers License.
    *
    * @param voterId - an array of choices
    * @returns - yes if valid Voter, no if invalid - 한번에 정보를 가져와서 실행하는게 나은것 같은데 일단 실행이 되는 방향으로 구현
    */
   async validateStudentId(studentId, studentPW) {
     //VoterId error checking here, i.e. check if valid drivers License, or state ID 현재는 그냥 voterID 변수안에 값만 있으면 검증이 완료됨 추후에 수정 필요
     if (studentId && studentPW) {
       return (await this.requestStudent(studentId, studentPW));
     } else {
       return false;
     }
   }

  /**
   *
   * validateRegistrar
   *
   * check for valid registrarId, should be cross checked with government
   *
   * @param voterId - an array of choices
   * @returns - yes if valid Voter, no if invalid
   */
  async requestStudent(studentId, studentPW) {

    //registrarId error checking here, i.e. check if valid drivers License, or state ID 현재는 그냥 변수안에 값만 있으면 검증이 완료됨 추후에 수정 필요
    const path = require('path');
    const fs = require('fs');

    const StudentDataPath = path.join(process.cwd(), './data/studentData.json');
    const StudentDataJson = fs.readFileSync(StudentDataPath, 'utf8');
    const StudentData = JSON.parse(StudentDataJson);

    if ((StudentData.studentId === studentId)&&(StudentData.studentPW === studentPW)) {
      //console.log(StudentData.studentdepartment);
      return await StudentData.studentdepartment;
    } else {
      return false;
    }
  }

}
module.exports = Voter;
