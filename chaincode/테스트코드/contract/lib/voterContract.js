/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

//import Hyperledger Fabric 1.4 SDK
const { Contract } = require('fabric-contract-api');
const path = require('path');
const fs = require('fs');

//import our file which contains our constructors and auxiliary function
let Ballot = require('./Ballot.js');
let Election = require('./Election.js');
let Voter = require('./Voter.js');
let VotableItem = require('./VotableItem.js');

class MyAssetContract extends Contract {

  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  // KDG written starts
  async validate(input) {
      if (input) {
      return true;
      } else {
      return false;
      }
  }
  async createElection(ctx, args) {
    console.log('createElection was called!'); 
      
    args = JSON.parse(args);

    if(await this.validate(args.name) && await this.validate(args.univ) && await this.validate(args.startdate) && await this.validate(args.enddate)){
      let electionStartDate = new Date(args.startdate);
      let electionEndDate = new Date(args.enddate);

      let election = new Election(args.name, args.univ, electionStartDate, electionEndDate);
      await ctx.stub.putState(election.electionid, Buffer.from(JSON.stringify(election)));
      return election;

    } else {
      let response = {};
      response.error = '정상적이지 않은 입력입니다! : '+ args;
      return response;
    }
  }
  // KDG written end
  ////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   *
   * init
   *
   * This function creates voters and gets the application ready for use by creating 
   * an election from the data files in the data directory.
   * 
   * @param ctx - the context of the transaction
   */
  async init(ctx) {
    console.log('instantiate was called!');
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
   * @param args.univ - department of university
   * @returns - nothing - but updates the world state with a voter
   */
  async createVoter(ctx, args) {

    args = JSON.parse(args);

    //create a new voter
    let newVoter = await new Voter(args.voterId, args.univ);

    //update state with new voter
    await ctx.stub.putState(newVoter.voterId, Buffer.from(JSON.stringify(newVoter)));

    //query state for elections
    let currElections = JSON.parse(await this.queryByObjectType(ctx, 'election'));

    if (currElections.length === 0) {
      let response = {};
      response.error = 'no elections. Create election first.';
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
   * @param votableId - the Id of the candidate the voter has selected.
   * @returns an array which has the winning briefs of the ballot. 
   */
  async castVote(ctx, args) {
    args = JSON.parse(args);

    //get the political party the voter voted for, also the key
    let votableId = args.picked;

    //check to make sure the election exists
    let electionExists = await this.myAssetExists(ctx, args.electionId);

    if (electionExists) {

      //make sure we have an election
      let electionAsBytes = await ctx.stub.getState(args.electionId);
      let election = await JSON.parse(electionAsBytes);
      let voterAsBytes = await ctx.stub.getState(args.walletid);
      let voter = await JSON.parse(voterAsBytes);

      if (voter.totalElectionCast) { //총학생회 투표, 단과대 투표 두개를 확인해야한다.
        let response = {};
        response.error = 'this voter has already cast this ballot!';
        return response;
      }

      //check the date of the election, to make sure the election is still open
      let currentTime = await new Date(args.currentTime);

      //parse date objects
      let parsedCurrentTime = await Date.parse(currentTime);
      let electionStart = await Date.parse(election.startDate);
      let electionEnd = await Date.parse(election.endDate);

      //only allow vote if the election has started 
      if (parsedCurrentTime >= electionStart && parsedCurrentTime < electionEnd) {

        let votableExists = await this.myAssetExists(ctx, votableId);
        if (!votableExists) {
          let response = {};
          response.error = 'VotableId does not exist!';
          return response;
        }

        //get the votable object from the state - with the votableId the user picked
        let votableAsBytes = await ctx.stub.getState(votableId);
        let votable = await JSON.parse(votableAsBytes);

        //increase the vote of the political party that was picked by the voter
        await votable.count++;

        //update the state with the new vote count
        let result = await ctx.stub.putState(votableId, Buffer.from(JSON.stringify(votable)));
        console.log(result);

        //make sure this voter cannot vote again! 
        if(args.univ === '총학생회'){
          voter.totalElectionCast = true; 
        }else{
          voter.departmentElectionCast = true;
        }
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

  /**
   * Query and return all key value pairs in the world state.
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
