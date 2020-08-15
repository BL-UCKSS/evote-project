'use strict';

class Student {
  /**
   *
   * 
   * voter is 이거는 VBallot 주소들을 저장하기 위해 사용하는 함수이다. 
   *  
   * @param items - an array of choices 
   * @param registrarId - 단과 
   * @param walletId - 랜덤한 고유아이디(중복없는)
   * @returns - registrar object
   */
  constructor(walletId) {

    if (this.validateInput(walletId)) {
      this.walletId = walletId;
      this.totalElectionVoterId = "NULL";
      this.departmentElectionVoterId = "NULL";
      this.reTotalElectionVoterId = 'NULL';
      this.reDepartmentElectionVoterId = "NULL";
      this.type = 'student';
      return this;

    } else if (!this.validateInput(walletId)){
      throw new Error('walletId는 비어있습니다.');
    } else {
      throw new Error('election이 비어있습니다..');
    }

  }

  
  async validateInput(input) {
    //VoterId error checking here, i.e. check if valid drivers License, or state ID
    if (input) {
      return true;
    } else {
      return false;
    }
  }

  async enrollVBallot(VBallot) {
    if (VBallot) {
      return true;
    } else if( ) {
      return false;
    }
  }

}
module.exports = Student;