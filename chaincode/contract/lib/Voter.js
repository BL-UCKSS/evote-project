'use strict';

class Voter {
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
  constructor(voterId, registrarId) {

    if (this.validateVoter(voterId) && this.validateRegistrar(registrarId)) {
      this.voterId = voterId;
      this.registrarId = registrarId;
      this.ballotCreated = false;
      this.type = 'voter';
      if (this.__isContract) {
        delete this.__isContract;
      }
      if (this.name) {
        delete this.name;
      }
      return this;

    } else if (!this.validateVoter(voterId)){
      throw new Error('the voterId is not valid.');
    } else {
      throw new Error('the registrarId is not valid.');
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
  async validateVoter(voterId) {
    //VoterId error checking here, i.e. check if valid drivers License, or state ID
    if (voterId) {
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
  async validateRegistrar(registrarId) {

    //registrarId error checking here, i.e. check if valid drivers License, or state ID
    if (registrarId) {
      return true;
    } else {
      return false;
    }
  }

}
module.exports = Voter;