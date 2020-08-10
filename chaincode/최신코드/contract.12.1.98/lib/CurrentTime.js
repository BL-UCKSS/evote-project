'use strict';

class CurrentTime {

    /**
   *
   * timeData - 현재 시간을 담고 있는 변수
   *
   * Constructor for a VotableItem object. These will eventually be placed on the
   * ballot.
   *
   * @param votableId - the Id of the votableItem
   * @param description - the description of the votableItem
   * @param voterId - the unique Id which corresponds to a registered voter
   * @returns - registrar object
   */
  constructor(ctx, timeData) {
    this.timeData = timeData;
    this.type = 'CurrentTime';
    if (this.__isContract) {
      delete this.__isContract;
    }
    return this;

  }
}
module.exports = CurrentTime;