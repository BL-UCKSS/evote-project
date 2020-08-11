'use strict';

class Election {

  /**

   *
   * @param electionId - an array of choices
   * @returns - yes if valid Voter, no if invalid
   */

  //유효한 선거인지 확인하는 코드를 추가할 수 있는 부분
  async validateElection(electionId) {

    //registrarId error checking here, i.e. check if valid drivers License, or state ID 추후에 트랜잭션에서 값을 불러와서 검증해야 할지???
    if (electionId) {
      return true;
    } else {
      return false;
    }
  }
  constructor(name, univ, startDate, endDate) {
    // 28자리 임의의 스트링 출력
    this.electionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    if (this.validateElection(this.electionId)) {

      //create the election object 객체 안에 들어가는 값들
      this.name = name;
      this.univ = univ;
      this.startDate = startDate;
      this.endDate = endDate;
      this.type = 'election';
      return this;

    } else {
      
      throw new Error('선거 아이디가 생성되지 못했습니다!');
    }

  }

}
module.exports = Election;
