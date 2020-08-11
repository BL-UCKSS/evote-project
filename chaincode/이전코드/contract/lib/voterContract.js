/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

//import Hyperledger Fabric 1.4 SDK
const { Contract } = require('fabric-contract-api');
const path = require('path');
const fs = require('fs');

// connect to the election data file
const electionDataPath = path.join(process.cwd(), './lib/data/electionData.json');
const electionDataJson = fs.readFileSync(electionDataPath, 'utf8');
const electionData = JSON.parse(electionDataJson);

// connect to the pres election file
const ballotDataPath = path.join(process.cwd(), './lib/data/presElection.json');
const ballotDataJson = fs.readFileSync(ballotDataPath, 'utf8');
const ballotData = JSON.parse(ballotDataJson);

//import our file which contains our constructors and auxiliary function
let Ballot = require('./Ballot.js');
let Election = require('./Election.js');
let Voter = require('./Voter.js');
let VotableItem = require('./VotableItem.js');
let CurrentTime = require('./CurrentTime.js');

class MyAssetContract extends Contract {

  /**
   *
   * init
   *
   * This function creates voters and gets the application ready for use by creating 
   * an election from the data files in the data directory.
   * 
   * @param ctx - the context of the transaction
   * @returns the voters which are registered and ready to vote in the election
   총책01:선거를 시작한다
   */
  async init(ctx) {

    console.log('instantiate was called!');

    let voters = [];
    let votableItems = [];
    let elections = [];
    let election;
    let currentTime;

    //create voters
    let voter1 = await new Voter('V1', '234');

    //update voters array
    voters.push(voter1);
  

    //add the voters to the world state, the election class checks for registered voters 
    await ctx.stub.putState(voter1.voterId, Buffer.from(JSON.stringify(voter1)));
    

    //query for election first before creating one.
    let currElections = JSON.parse(await this.queryByObjectType(ctx, 'election'));

    if (currElections.length === 0) {

      //Nov 3 is election day
      let electionStartDate = await new Date(electionData.electionStartYear,electionData.electionStartMonthdata -1 , electionData.electionStartDay);
      let electionEndDate = await new Date(electionData.electionEndYear, electionData.electionENdMonthdata-1 , electionData.electionENdDay);

      //create the election
      election = await new Election(electionData.electionName, electionData.electionCountry,
        electionData.electionStartYear, electionStartDate, electionEndDate);

      //update elections array
      elections.push(election);
    

      await ctx.stub.putState(election.electionId, Buffer.from(JSON.stringify(election)));


        //시간 데이터 생성
        /*
      currentTime = await new CurrentTime(electionStartDate);
      await ctx.stub.putState(currentTime.timeData, Buffer.from(JSON.stringify(currentTime)));
*/
    } else {
      election = currElections[0];
    }
  
  

    //create votableItems for the ballots - 선택가능한 후보자들 업데이트
    for(var prop in ballotData) {

      let res = await new VotableItem(ctx, ballotData[prop][0], ballotData[prop][1], ballotData[prop][2]);
      votableItems.push(res);
    }

    for (let i = 0; i < votableItems.length; i++) {
    
      //save votable choices in world state
      await ctx.stub.putState(votableItems[i].votableCandidate, Buffer.from(JSON.stringify(votableItems[i])));
    }

    //generate ballots for all voters
    

        //give each registered voter a ballot
    await this.generateBallot(ctx, votableItems, election, voters[0]);


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

    //generate ballot
    let ballot = await new Ballot(ctx, votableItems, election, voter.voterId);
    
    //set reference to voters ballot
    voter.ballot = ballot.ballotId;
    voter.ballotCreated = true;

    // //update state with ballot object we just created
    await ctx.stub.putState(ballot.ballotId, Buffer.from(JSON.stringify(ballot)));

    await ctx.stub.putState(voter.voterId, Buffer.from(JSON.stringify(voter)));

  }


  /**
   *
   * createVoter
   *
   * Creates a voter in the world state, based on the args given.
   *  
   * @param args.voterId - the Id the voter, used as the key to store the voter object
   * @param args.registrarId - the registrar the voter is registered for
   * @param args.firstName - first name of voter
   * @param args.lastName - last name of voter
   * @returns - nothing - but updates the world state with a voter
   */
  async createVoter(ctx, args) {

    args = JSON.parse(args);

    //create a new voter
    let newVoter = await new Voter(args.voterId, args.registrarId);

    //update state with new voter
    await ctx.stub.putState(newVoter.voterId, Buffer.from(JSON.stringify(newVoter)));

    //query state for elections
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

    let response = `voter with voterId ${newVoter.voterId} is updated in the world state`;
    return response;
  }



  /**
   *
   * deleteMyAsset
   *
   * Deletes a key-value pair from the world state, based on the key given.
   *  
   * @param myAssetId - the key of the asset to delete
   * @returns - nothing - but deletes the value in the world state
   * 총책02: 선거를 삭제 및 중단한다 B02
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
   * readMyAsset
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

    const buffer = await ctx.stub.getState(myAssetId);
    const asset = JSON.parse(buffer.toString());
    return asset;
  }


 
  /**
   *
   * myAssetExists
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
   * the world state. 
   * 
   * @param electionId - the electionId of the election we want to vote in
   * @param voterId - the voterId of the voter that wants to vote
   * @param votableCandidate - the Id of the candidate the voter has selected.
   * @returns an array which has the winning briefs of the ballot. 
  학생05: 후보자에게 투표한다
   */
  async castVote(ctx, args) {
    args = JSON.parse(args);

    //get the political party the voter voted for, also the key
    let votableCandidate = args.picked;

    //check to make sure the election exists 총책01: E01 등록된 선거가 없을 경우
    let electionExists = await this.myAssetExists(ctx, args.electionId);

    if (electionExists) {

      //make sure we have an election
      let electionAsBytes = await ctx.stub.getState(args.electionId);
      let election = await JSON.parse(electionAsBytes);
      let voterAsBytes = await ctx.stub.getState(args.voterId);
      let voter = await JSON.parse(voterAsBytes);
      console.log(votableCandidate);
      if (voter.totalElectionCast) {
        let response = {};
        response.error = '이미 총학선거를 진행하셨습니다.';

        return response;
      }
      

      //parse date objects -- 현재 시간 하드코딩 추후 수정 필요 - 수정 시작

      let currentTime = await new Date();
      let parsedCurrentTime = await Date.parse(currentTime);
      let electionStart = await Date.parse(election.startDate);
      let electionEnd = await Date.parse(election.endDate);

      

      //only allow vote if the election has started 
      if (parsedCurrentTime >= electionStart && parsedCurrentTime < electionEnd) {

        let votableExists = await this.myAssetExists(ctx, votableCandidate);
        if (!votableExists) {
          let response = {};
          response.error = '선택하신 후보자가 존재하지 않습니다!';
          return response;
        }

        //get the votable object from the state - with the votableCandidate the user picked
        let votableAsBytes = await ctx.stub.getState(votableCandidate);
        let votable = await JSON.parse(votableAsBytes);

        //increase the vote of the political party that was picked by the voter
        await votable.count++;

        //update the state with the new vote count
        let result = await ctx.stub.putState(votableCandidate, Buffer.from(JSON.stringify(votable)));
        console.log(result);

        //make sure this voter cannot vote again! 
        voter.totalElectionCast = true;
        voter.picked = {};
        voter.picked = args.picked;

        //update state to say that this voter has voted, and who they picked
        let response = await ctx.stub.putState(voter.voterId, Buffer.from(JSON.stringify(voter)));
        console.log(response);

       
        

        return voter;

      } else {
        let response = {};
        response.error = 'the election is not open now!';
        return response;
      }

    } else {
      let response = {};
      response.error = 'the election or the voter does not exist!';
      return response;
    }
  }

  




/*
단과대 선거 
*/
  async castDepartmentVote(ctx, args) {
    args = JSON.parse(args);

    //get the political party the voter voted for, also the key
    let votableCandidate = args.picked;

    //check to make sure the election exists 총책01: E01 등록된 선거가 없을 경우
    let electionExists = await this.myAssetExists(ctx, args.electionId);

    if (electionExists) {

      //make sure we have an election
      let electionAsBytes = await ctx.stub.getState(args.electionId);
      let election = await JSON.parse(electionAsBytes);
      let voterAsBytes = await ctx.stub.getState(args.voterId);
      let voter = await JSON.parse(voterAsBytes);

      if (voter.departmentElectionCast) {
        let response = {};
        response.error = '이미 단과대선거를 진행하셨습니다.';
        return response;
      }
      

      //parse date objects -- 현재 시간 하드코딩 추후 수정 필요
      let currentTime = await await new Date();
      let parsedCurrentTime = await Date.parse(currentTime);
      let electionStart = await Date.parse(election.startDate);
      let electionEnd = await Date.parse(election.endDate);

      //only allow vote if the election has started 
      if (parsedCurrentTime >= electionStart && parsedCurrentTime < electionEnd) {

        let votableExists = await this.myAssetExists(ctx, votableCandidate);
        if (!votableExists) {
          let response = {};
          response.error = '현재 선택하신 후보가 존재하지 않습니다. 기술팀에 문의해주세요!';
          return response;
        }

        //get the votable object from the state - with the votableCandidate the user picked
        let votableAsBytes = await ctx.stub.getState(votableCandidate);
        let votable = await JSON.parse(votableAsBytes);

        //increase the vote of the political party that was picked by the voter 같은 단과대인지 확인후 투표진행
        if(votable.description === voter.registrarId ) {
          await votable.count++;
        } else {
          let response = {};
          response.error = '소속한 단과대가 아닙니다!';
          return response;
        }
        //update the state with the new vote count
        let result = await ctx.stub.putState(votableCandidate, Buffer.from(JSON.stringify(votable)));
        console.log(result);

        //make sure this voter cannot vote again! 
        voter.departmentElectionCast = true;
        voter.departmentPicked = {};
        voter.departmentPicked = args.picked;

        //update state to say that this voter has voted, and who they picked
        let response = await ctx.stub.putState(voter.voterId, Buffer.from(JSON.stringify(voter)));
        console.log(response);
        return voter;

      } else {
        let response = {};
        response.error = '현재 선거기간이 아닙니다!';
        return response;
      }

    } else {
      let response = {};
      response.error = '1분이 지난후에도 선거가 진행되지 않으면 기술팀에 문의해주세요!';
      return response;
    }
  }

  /**
   * Query and return all key value pairs in the world state.
   *
   * @param {Context} ctx the transaction context
   * @returns - all key-value pairs in the world state
   * 
   * 총책03: 실시간 투표율을 확인한다(프론트에서 활용하여 투표율로 변환하였다.)
   * 학생07: 선거 결과를 확인한다(프론트에서 활용)
  */
  async queryAll(ctx) {

    let queryString = {
      selector: {}
    };

    let queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
    return queryResults;

  }

  /**
     * Evaluate a queryString
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

  /**
  * Query by the main objects in this app: ballot, election, votableItem, and Voter. 
  * Return all key-value pairs of a given type. 
  *
  * @param {Context} ctx the transaction context
  * @param {String} objectType the type of the object - should be either ballot, election, votableItem, or Voter
  
  학생03: B01 선거 목록을 확인한다(선거 타입을 리턴해 주는 함수)
  총책03: 실시간 투표율을 확인한다(프론트에서 활용하여 투표율로 변환하였다.??)
    학생07: 선거 결과를 확인한다(프론트에서 활용)
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


 // 보터 아이디에 해당하는 투표 결과를 리턴
  async queryByWalletid(ctx, walletid ) {

    let queryString = {
      selector: {
        type: "voter"
      }
    };
  
    let queryResult;
    let queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
    
    let res = queryResults.indexOf(walletid);
    
    if(res!= -1){
        queryResult = queryResults.substring(res, queryResults.indexOf(walletid,res+9));
        return queryResult;
      }
    
    let response = {};
    response.error = '해당하는 WalletID가 존재하지 않습니다!';
    return response;

  }

}
module.exports = MyAssetContract;


/**
  
총책02 : B01 중단시킬 선거를 선택한다 - 여러개의 선거를 구현 했을때 

학생01: url을 클릭한다 (우리가 구현할거는 아님)

학생02: 선거창에 접속하여 로그인한다 

학생03 : B02 참여하고자 하는 선거를 선택한다. 

학생04: 유의사항에 동의한다 () 

학생08 : 관리자에게 건의한다.

*/

