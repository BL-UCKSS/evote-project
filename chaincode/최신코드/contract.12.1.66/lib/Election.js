'use strict';

class Election {

  /**
   *
   * validateElection
   *
   * check for valid election, cross check with government. Don't want duplicate
   * elections.
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
  /**
   *
   * Election
   *
   * Constructor for an Election object. Specifies start and end date.
   *
   * @param items - an array of choices
   * @param election - what election you are making ballots for
   * @param voterId - the unique Id which corresponds to a registered voter
   * @returns - registrar object
   */
  constructor(name, univ, startDate, endDate) {
    // 28자리 임의의 스트링 출력
    this.electionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    if (this.validateElection(this.electionId)) {

      //create the election object 객체 안에 들어가는 값들
      this.name = name;
      this.univ = univ;
      this.startDate = startDate;
      this.endDate = endDate;
      this.check = univ + startDate.getFullYear();
      this.type = 'election';
      if (this.__isContract) {
        delete this.__isContract;
      }
      return this;

    } else {
      
      throw new Error('not a valid election!');
    }

  }

}
module.exports = Election;
