'use strict';

const crypto = require('crypto');

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
  constructor(walletId, election) {

    if (this.validateInput(walletId) && this.validateInput(election)) {
      this.walletId = walletId;
      this.election = election;
      //this.voterId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      this.type = 'vBallot';
      this.picked = "NULL";
      let tmp = JSON.stringify(election) + this.walletId + this.type;
      this.voterId = crypto.createHash('sha256').update(tmp).digest('base64');
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

}
module.exports = VBallot;