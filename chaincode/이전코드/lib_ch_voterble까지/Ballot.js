'use strict';

class Ballot {

  /**
   *
   * Ballot
   *
   * Constructor for a Ballot object. This is what the point of the application is - create
   * ballots, have a voter fill them out, and then tally the ballots. -  집계를 위한 투표용지
   *
   * @param items - an array of choices 투표 선택지
   * @param election - what election you are making ballots for  - 선거
   * @param voterId - the unique Id which corresponds to a registered voter - 유권자 식별정보
   * @returns - registrar object
   */
  constructor(ctx, items, election, voterId) {
    // 유권자의 선택을 변수로 받는다.
    if (this.validateBallot(ctx, voterId)) {

      this.votableItems = items;
      this.election = election;
      this.voterId = voterId;
      //동의, 총학, 과 투표를 구별하기 위한 변수
      this.totalElectionCast = false;
      this.departmentElectionCast = false;
      // 투표용지 식별을 위한 아이디 : 28자리의 랜덤 스트링 출력
      this.ballotId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      this.type = 'ballot';
      // 개념 5
      if (this.__isContract) {
        delete this.__isContract;
      }
      if (this.name) {
        delete this.name;
      }
      return this;

    } else {
      console.log('a ballot has already been created for this voter');
      throw new Error ('a ballot has already been created for this voter');
    }
  }

  /**
   *
   * validateBallot
   *
   * check to make sure a ballot has not been created for this
   * voter.
   *
   * @param voterId - the unique Id for a registered voter
   * @returns - yes if valid Voter, no if invalid
   */
  async validateBallot(ctx, voterId) {

    const buffer = await ctx.stub.getState(voterId);
    //개념 2
    if (!!buffer && buffer.length > 0) {
      let voter = JSON.parse(buffer.toString());

      // 보터 객체안에 ballotCreated가 false일때 동작
      if (voter.ballotCreated) {
        console.log('ballot has already been created for this voter');
        return false;
      } else {
        return true;
      }
    } else {
      // 유권자 아이디가 트렌젝션에 없는 경우
      console.log('This ID is not registered to vote.');
      return false;
    }
  }
}
// 개념 1
module.exports = Ballot;
