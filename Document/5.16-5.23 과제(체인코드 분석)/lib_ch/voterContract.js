/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

//import Hyperledger Fabric 1.4 SDK - 하이퍼페브릭 불러오기
const { Contract } = require('fabric-contract-api');
const path = require('path');
const fs = require('fs');

// connect to the election data file 선거 데이터를 미리 파일로 준비해서 실행(나중에 선거를 고치면 여기 json 파일도 수정하면 될거 같습니다. 실행 기간 미포함)
const electionDataPath = path.join(process.cwd(), './lib/data/electionData.json');
const electionDataJson = fs.readFileSync(electionDataPath, 'utf8');
const electionData = JSON.parse(electionDataJson);

// connect to the pres election file 사용자가 투표용지에서 고를수 있는 선택지들을 불러옵니다.
const ballotDataPath = path.join(process.cwd(), './lib/data/presElection.json');
const ballotDataJson = fs.readFileSync(ballotDataPath, 'utf8');
const ballotData = JSON.parse(ballotDataJson);

//import our file which contains our constructors and auxiliary function 투표를 위한 객채 생성
let Ballot = require('./Ballot.js');
let Election = require('./Election.js');
let Voter = require('./Voter.js');
let VotableItem = require('./VotableItem.js');

class MyAssetContract extends Contract {

  /**
   *
   * init
   *
   * This function creates voters and gets the application ready for use by creating
   * an election from the data files in the data directory. - 컨트랙트 모듈 시작 - 실제적으로 트랜잭션이 변경되는 부분
   *
   * @param ctx - the context of the transaction
   * @returns the voters which are registered and ready to vote in the election
   */
  async init(ctx) {

    console.log('instantiate was called!');
    // 오류 확인을 위한? 리스트

    let voters = [];
    let votableItems = [];
    let elections = [];
    let election;

    //create voters 예시를 위한 하드 코딩 코드에 흐름만 파악하고 지우면 됩니다. - 유권자 객채 생성
    let voter1 = await new Voter('V1', '234', 'Horea', 'Porutiu');
    let voter2 = await new Voter('V2', '345', 'Duncan', 'Conley');

    //update voters array 예시를 위한 하드 코딩 코드에 흐름만 파악하고 지우면 됩니다. - 유권자객채 voters 리스트에 푸쉬
    voters.push(voter1);
    voters.push(voter2);

    //add the voters to the world state, the election class checks for registered voters  - 트랜잭션에 유권자 정보 푸쉬
    await ctx.stub.putState(voter1.voterId, Buffer.from(JSON.stringify(voter1)));
    await ctx.stub.putState(voter2.voterId, Buffer.from(JSON.stringify(voter2)));

    //query for election first before creating one. 실행되고 있는 선거가 있는지 확인
    let currElections = JSON.parse(await this.queryByObjectType(ctx, 'election'));
    // 실행되는 선거가 없으면 생성

    if (currElections.length === 0) {

      //Nov 3 is election day - 예시를 위한 하드코딩이지만 저희도 시작날짜와 종료날짜를 하드코딩해서 제공하면 될거 같습니다.
      let electionStartDate = await new Date(2020, 11, 3);
      let electionEndDate = await new Date(2020, 11, 4);

      //create the election 선거 생성
      election = await new Election(electionData.electionName, electionData.electionCountry,
        electionData.electionYear, electionStartDate, electionEndDate);

      //update elections array 모듈 리스트에 업데이트
      elections.push(election);

      // 트렌젝션에 업데이트

      await ctx.stub.putState(election.electionId, Buffer.from(JSON.stringify(election)));

    } else {
      election = currElections[0];
    }

    //create votableItems for the ballots - 선택가능한 후보자들 업데이트(정당이 하드코딩 되어있다.)
    let repVotable = await new VotableItem(ctx, 'Republican', ballotData.fedDemocratBrief);
    let demVotable = await new VotableItem(ctx, 'Democrat', ballotData.republicanBrief);
    let indVotable = await new VotableItem(ctx, 'Green', ballotData.greenBrief);
    let grnVotable = await new VotableItem(ctx, 'Independent', ballotData.independentBrief);
    let libVotable = await new VotableItem(ctx, 'Libertarian', ballotData.libertarianBrief);

    //populate choices array so that the ballots can have all of these choices - 모듈 리스트에 추가
    votableItems.push(repVotable);
    votableItems.push(demVotable);
    votableItems.push(indVotable);
    votableItems.push(grnVotable);
    votableItems.push(libVotable);
    // 트랜잭션에 푸쉬
    for (let i = 0; i < votableItems.length; i++) {

      //save votable choices in world state
      await ctx.stub.putState(votableItems[i].votableId, Buffer.from(JSON.stringify(votableItems[i])));

    }

    //generate ballots for all voters
    for (let i = 0; i < voters.length; i++) {

      if (!voters[i].ballot) {

        //give each registered voter a ballot - 내부함수를 이용해 투표 실행  - 여기
        await this.generateBallot(ctx, votableItems, election, voters[i]);

      } else {
        console.log('these voters already have ballots');
        break;
      }

    }

    return voters;

  }

  /**
   *
   * generateBallot
   *
   * Creates a ballot in the world state, and updates voter ballot and castBallot properties.
   *
   * @param ctx - the context of the transaction
   * @param votableItems - The different political parties and candidates you can vote for, which are on the ballot.
   * @param election - the election we are generating a ballot for. All ballots are the same for an election.
   * @param voter - the voter object
   * @returns - nothing - but updates the world state with a ballot for a particular voter object
   */
  async generateBallot(ctx, votableItems, election, voter) {

    //generate ballot - 투표지 객체 생성
    let ballot = await new Ballot(ctx, votableItems, election, voter.voterId);

    //set reference to voters ballot - 사용자의 중복투표를 막고 나중에  투표지 조회 가능
    voter.ballot = ballot.ballotId;
    voter.ballotCreated = true;

    // //update state with ballot object we just created - 투표지와 유권자의 데이터 변화를 트렌잭션에 업데이트
    await ctx.stub.putState(ballot.ballotId, Buffer.from(JSON.stringify(ballot)));

    await ctx.stub.putState(voter.voterId, Buffer.from(JSON.stringify(voter)));

  }


  /**
   *
   * createVoter
   *
   * Creates a voter in the world state, based on the args given. - 모듈에 초기화 이후 유권자 등록을 위한 함수
   *
   * @param args.voterId - the Id the voter, used as the key to store the voter object
   * @param args.registrarId - the registrar the voter is registered for
   * @param args.firstName - first name of voter
   * @param args.lastName - last name of voter
   * @returns - nothing - but updates the world state with a voter
   */
  async createVoter(ctx, args) {

    args = JSON.parse(args);

    //create a new voter - 사용자의 입력을 받아 유권자 객체 생성
    let newVoter = await new Voter(args.voterId, args.registrarId, args.firstName, args.lastName);

    //update state with new voter 트렌젝션 생성
    await ctx.stub.putState(newVoter.voterId, Buffer.from(JSON.stringify(newVoter)));

    //query state for elections 선거가 있는지 조회해보고 바로 실행
    let currElections = JSON.parse(await this.queryByObjectType(ctx, 'election'));

    if (currElections.length === 0) {
      let response = {};
      response.error = 'no elections. Run the init() function first.';
      return response;
    }

    //get the election that is created in the init function
    let currElection = currElections[0];

    let votableItems = JSON.parse(await this.queryByObjectType(ctx, 'votableItem'));

    //generate ballot with the given votableItems
    await this.generateBallot(ctx, votableItems, currElection, newVoter);
    // 사용자에게 자신의 voterId 리턴하고 좋료
    let response = `voter with voterId ${newVoter.voterId} is updated in the world state`;
    return response;
  }



  /**
   *
   * deleteMyAsset - 선거 중단기능으로 생각해도 될거 같습니다.
   *
   * Deletes a key-value pair from the world state, based on the key given.
   *
   * @param myAssetId - the key of the asset to delete
   * @returns - nothing - but deletes the value in the world state
   */
  async deleteMyAsset(ctx, myAssetId) {

    const exists = await this.myAssetExists(ctx, myAssetId);
    if (!exists) {
      throw new Error(`The my asset ${myAssetId} does not exist`);
    }

    await ctx.stub.deleteState(myAssetId);

  }

  /**
   *
   * readMyAsset - 현재까지 트랜잭션을 조회하는 함수?
   *
   * Reads a key-value pair from the world state, based on the key given.
   *
   * @param myAssetId - the key of the asset to read
   * @returns - nothing - but reads the value in the world state
   */
  async readMyAsset(ctx, myAssetId) {

    const exists = await this.myAssetExists(ctx, myAssetId);

    if (!exists) {
      // throw new Error(`The my asset ${myAssetId} does not exist`);
      let response = {};
      response.error = `The my asset ${myAssetId} does not exist`;
      return response;
    }
    //개념 6
    const buffer = await ctx.stub.getState(myAssetId);
    const asset = JSON.parse(buffer.toString());
    return asset;
  }



  /**
   *
   * myAssetExists - 현재 myAsset가 작동중인지 확인하는 함수
   *
   * Checks to see if a key exists in the world state.
   * @param myAssetId - the key of the asset to read
   * @returns boolean indicating if the asset exists or not.
   */
  async myAssetExists(ctx, myAssetId) {

    const buffer = await ctx.stub.getState(myAssetId);
    return (!!buffer && buffer.length > 0);

  }

  /**
   *
   * castVote
   *
   * First to checks that a particular voterId has not voted before, and then
   * checks if it is a valid election time, and if it is, we increment the
   * count of the political party that was picked by the voter and update
   * the world state.  - 초기화 이후 실질적으로 유권자의 투표를 실행하는 함수, 엔진?
   *
   * @param electionId - the electionId of the election we want to vote in
   * @param voterId - the voterId of the voter that wants to vote
   * @param votableId - the Id of the candidate the voter has selected.
   * @returns an array which has the winning briefs of the ballot.
   */
  async castVote(ctx, args) {
    args = JSON.parse(args);

    //get the political party the voter voted for, also the key - 유권자의 후보자 선택 받아오기
    let votableId = args.picked;

    //check to make sure the election exists - 선거가 진행중인지 확인
    let electionExists = await this.myAssetExists(ctx, args.electionId);

    if (electionExists) {

      //make sure we have an election - 트랜잭션에서 투표정보와 선거정보를 가져온다.
      let electionAsBytes = await ctx.stub.getState(args.electionId);
      let election = await JSON.parse(electionAsBytes);
      let voterAsBytes = await ctx.stub.getState(args.voterId);
      let voter = await JSON.parse(voterAsBytes);

      if (voter.ballotCast) {
        let response = {};
        response.error = 'this voter has already cast this ballot!';
        return response;
      }

      //check the date of the election, to make sure the election is still open  - 현재 시간을 확인하여 끝난선거를 진행하지 못하게함 (하드코딩)
      let currentTime = await new Date(2020, 11, 3);

      //parse date objects - 요기는 냅두면 될거 같습니다.
      let parsedCurrentTime = await Date.parse(currentTime);
      let electionStart = await Date.parse(election.startDate);
      let electionEnd = await Date.parse(election.endDate);

      //only allow vote if the election has started 현재 시간이 투표시간 안이여야 실행
      if (parsedCurrentTime >= electionStart && parsedCurrentTime < electionEnd) {
        // 원장에서 아이디 가져오기
        let votableExists = await this.myAssetExists(ctx, votableId);
        if (!votableExists) {
          let response = {};
          response.error = 'VotableId does not exist!';
          return response;
        }

        //get the votable object from the state - with the votableId the user picked 유권자가 선택한 후보자 불러오기
        let votableAsBytes = await ctx.stub.getState(votableId);
        let votable = await JSON.parse(votableAsBytes);

        //increase the vote of the political party that was picked by the voter - 해당 후보자 +1
        await votable.count++;

        //update the state with the new vote count 현재 투표수 원장에 업데이트
        let result = await ctx.stub.putState(votableId, Buffer.from(JSON.stringify(votable)));
        console.log(result);

        //make sure this voter cannot vote again!  - 뭔가 내용이 겹치는데 확인하곘습니다. - 개념 10
        voter.ballotCast = true;
        voter.picked = {};
        voter.picked = args.picked;

        //update state to say that this voter has voted, and who they picked - 원장에 잘 업데이트 되었는지 확인을 위해 선택한 후보자 출력
        let response = await ctx.stub.putState(voter.voterId, Buffer.from(JSON.stringify(voter)));
        console.log(response);
        return voter;

      } else { //선거 기간이아닐 경우
        let response = {};
        response.error = 'the election is not open now!';
        return response;
      }

    } else { // 선거가 존재하지 않으면
      let response = {};
      response.error = 'the election or the voter does not exist!';
      return response;
    }
  }

  /**
   * Query and return all key value pairs in the world state. - 모든 선거 selector 정보를 리턴 개념 9
   *
   * @param {Context} ctx the transaction context
   * @returns - all key-value pairs in the world state
  */
  async queryAll(ctx) {

    let queryString = {
      selector: {}
    };

    let queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
    return queryResults;

  }

  /**
     * Evaluate a queryString - 궈리 결과를 콘솔로 출력
     *
     * @param {Context} ctx the transaction context
     * @param {String} queryString the query string to be evaluated
    */
  async queryWithQueryString(ctx, queryString) {

    console.log('query String');
    console.log(JSON.stringify(queryString));

    let resultsIterator = await ctx.stub.getQueryResult(queryString);

    let allResults = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let res = await resultsIterator.next();

      if (res.value && res.value.value.toString()) {
        let jsonRes = {};

        console.log(res.value.value.toString('utf8'));

        jsonRes.Key = res.value.key;

        try {
          jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
        } catch (err) {
          console.log(err);
          jsonRes.Record = res.value.value.toString('utf8');
        }

        allResults.push(jsonRes);
      }
      if (res.done) {
        console.log('end of data');
        await resultsIterator.close();
        console.info(allResults);
        console.log(JSON.stringify(allResults));
        return JSON.stringify(allResults);
      }
    }
  }

  /** 쿼리 결과를 객체로 리턴
  * Query by the main objects in this app: ballot, election, votableItem, and Voter.
  * Return all key-value pairs of a given type.
  *
  * @param {Context} ctx the transaction context
  * @param {String} objectType the type of the object - should be either ballot, election, votableItem, or Voter
  */
  async queryByObjectType(ctx, objectType) {

    let queryString = {
      selector: {
        type: objectType
      }
    };

    let queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
    return queryResults;

  }
}
module.exports = MyAssetContract;
