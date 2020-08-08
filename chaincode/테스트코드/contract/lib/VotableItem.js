/* eslint-disable indent */
'use strict';

class VotableItem {

    /**
   *
   * VotableItem - 투표가능한 선택지를 담는 객체, 투표지를 담는 역할을 수행
   *
   * Constructor for a VotableItem object. These will eventually be placed on the
   * ballot.
   *
   * @param votableId - the Id of the votableItem
   * @param electionId - the Id of the election
   * @returns - registrar object
   */
  constructor(ctx, votableId, electionId) {
    this.votableId = votableId;
    this.electionId = electionId;
    this.count = 0;
    this.type = 'votableItem';
    if (this.__isContract) {
      delete this.__isContract;
    }
    return this;

  }
}
module.exports = VotableItem;
