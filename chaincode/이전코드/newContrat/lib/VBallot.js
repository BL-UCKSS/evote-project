'use strict';

class VBallot {
  /**
   *
   * Voter
   *
   * Constructor for a Voter object. Voter has a voterId and registrar that the
   * voter is . 
   *  
   * @param items - an array of choices 
   * @param registrarId - 단과 
   * @param voterId - 랜덤한 고유아이디(중복없는)
   * @returns - registrar object
   */
  constructor(walletId, election,) {

    if (this.validateVoter(walletId) && this.validateDepartment(election)) {
      this.walletId = walletId;
      this.election = election;
      this.voterId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      this.type = 'vBallot';
      //여기서 초기화 할지 나중에 추가할지 고민!
      //this.picked
      return this;

    } else if (!this.validateVoter(walletId)){
      throw new Error('walletId는 비어있습니다.');
    } else {
      throw new Error('election이 비어있습니다..');
    }

  }

  /**
   *
   * validateVoter
   *
   * check for valid ID card - stateID or drivers License.
   *  
   * @param voterId - an array of choices 
   * @returns - yes if valid Voter, no if invalid
   */
  async validateInput(input) {
    //VoterId error checking here, i.e. check if valid drivers License, or state ID
    if (input) {
      return true;
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

}
module.exports = VBallot;