/* eslint-disable indent */
'use strict';

class CandidateResult {

    /**

   * @param votableId - the Id of the votableItem
   * @param description - the description of the votableItem
   * @param voterId - the unique Id which corresponds to a registered voter
   * @returns - registrar object
   */
  constructor(ctx, name, electionId  ) {
    this.candidateId =  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.name = name;
    this.electionId = electionId;
    this.count = 0;
    this.type = 'candidateResult';
    return this;

  }
}
module.exports = CandidateResult;
