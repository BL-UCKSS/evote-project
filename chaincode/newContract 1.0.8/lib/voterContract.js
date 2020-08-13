/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

//import Hyperledger Fabric 1.4 SDK
const { Contract } = require('fabric-contract-api');
const path = require('path');
const fs = require('fs');

// connect to the election data file
const electionDataPath = path.join(process.cwd(), './lib/testData/electionData.json');
const electionDataJson = fs.readFileSync(electionDataPath, 'utf8');
const electionData = JSON.parse(electionDataJson);

// connect to the pres election file
const ballotDataPath = path.join(process.cwd(), './lib/testData/presElection.json');
const ballotDataJson = fs.readFileSync(ballotDataPath, 'utf8');
const ballotData = JSON.parse(ballotDataJson);

//import our file which contains our constructors and auxiliary function
let VBallot = require('./VBallot.js');
let Election = require('./Election.js');
let CandidateResult = require('./CandidateResult.js');

class MyAssetContract extends Contract {

  /**
   *
   * init 테스트용
   * 
   * @param ctx - the context of the transaction
   * @returns the voters which are registered and ready to vote in the election
   */
  async init(ctx) {
    console.log('instantiate was called!');

    let election;
    let votableItems = [];

    //선거 객체 생성 테스트
    let currElections = JSON.parse(await this.queryByObjectType(ctx, 'election'));

    if (currElections.length === 0) {

      //Nov 3 is election day
      let electionStartDate = await new Date(electionData.electionStartYear,electionData.electionStartMonthdata  , electionData.electionStartDay);
      let electionEndDate = await new Date(electionData.electionEndYear, electionData.electionENdMonthdata , electionData.electionENdDay);

      //create the election
      election = await new Election(electionData.electionName, electionData.electionCountry, electionStartDate, electionEndDate);
      await ctx.stub.putState(election.electionId, Buffer.from(JSON.stringify(election)));
    } else {
      election = currElections[0];
    }


    //VBallot 실험
    let vBallot1 = await new VBallot('V1', election);

    //add the voters to the world state, the election class checks for registered voters 
    await ctx.stub.putState(vBallot1.voterId, Buffer.from(JSON.stringify(vBallot1)));
    


    //CandidateResult 실험- 선택가능한 후보자들 업데이트

    let candidateResult = await new CandidateResult( "테스트후보자", election.electionId);
  
    await ctx.stub.putState(candidateResult.candidateId, Buffer.from(JSON.stringify(candidateResult)));
 

    return vBallot1;

  }








/*
  function: createElection(args)	//args: {name, univ, startdate, enddate)
return type: json
사용목적: 선거 생성 + 해당 선거에 출마한 후보자 등록
사용되는 UI: https://johndonggyu.github.io/HLF-Study/Frontend/registervote.html (app.js: /process/registervote)


*/
  async createElection(ctx, args) {
      
    args = JSON.parse(args);

    if(await this.validate(args.name) && await this.validate(args.univ) && await this.validate(args.startdate) 
    && await this.validate(args.enddate) ){
   //Nov 3 is election day
      let electionStartDate = await new Date(args.startdate);
      let electionEndDate = await new Date(args.enddate);

      //create the election
      let electionId = await this.generateElection(ctx, args.name, args.univ, electionStartDate, electionEndDate);

      // 후보자 등록하는 부분

      await this.generateCandidateResult(ctx , "기권" , electionId);
      
      for(var i in args.candidates){
        await this.generateCandidateResult(ctx ,args.candidates[i] , electionId);
      }


      //선거 아이디 리턴
      let response = {};
      response.success = electionId;
      return response;

    } else {
      let response = {};
      response.error = '값이 비어있는 인자가 있습니다!!!!!!!!!!!!!'+ args;
      return response;
    }
  }

  async generateElection(ctx ,name, univ, electionStartDate, electionEndDate) {

    //generate ballot
    let election = await new Election(name, univ, electionStartDate, electionEndDate);  
    // //update state with ballot object we just created
    await ctx.stub.putState(election.electionId, Buffer.from(JSON.stringify(election)));
    return election.electionId;

  }

/*
#4번
function: getElection(args)	//args{year, univ}	univ: 총학생회/ 융합공과대학/ 인문대학 ...
retury type: json
사용목적: 학생이 투표하는데에 필요한 선거를 불러오되, 
기본적으로 총학생회 선거를 불러오고, univ에 따라 단과대학생회 선거를 불러와야 함(총학생회+단과대학생회)
값 가져오는 부분 슈퍼 하드 코딩 -오류가 생기면 여기부터 볼것

async getElection(ctx, args ) {

  args = JSON.parse(args);

  let queryString = {
    selector: {
      type: "election"
    }
  };

  let queryResult;
  let queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
  
  let res = queryResults.indexOf(args.univ+args.year);
  
  if(res!= -1){
      let electionIdnum = queryResults.indexOf("electionId" ,res+1);
      let start = queryResults.indexOf(":" , electionIdnum+1);
      let end = queryResults.indexOf("," ,start+1);
      queryResult = queryResults.substring(start+2, end);
      return queryResult;
    }
  
  let response = {};
  response.error = '해당하는 WalletID가 존재하지 않습니다!';
  return response;

}

*/
//선거 수정 함수 modifyElection => 선거 삭제 구현한뒤 구현

async modifyElection(ctx, args) {

  console.log('modifyElection was called!'); 
    
  args = JSON.parse(args);

  
  if(await this.validate(args.name) && await this.validate(args.univ) && await this.validate(args.startdate) && await this.validate(args.enddate)){
 //Nov 3 is election day

    let electionExists = await this.myAssetExists(ctx, args.electionId);

    if (electionExists) {

   //make sure we have an election
     let electionAsBytes = await ctx.stub.getState(args.electionId);
     let election = await JSON.parse(electionAsBytes);
     let electionStartDate = await new Date(args.startdate);
     let electionEndDate = await new Date(args.enddate);
     let electionStartDateValidate = await new Date(args.startdate);
     await electionStartDateValidate.setDate(await electionStartDateValidate.getDate() - 3);


     if(await this.validatePreviousDate(electionStartDateValidate)){
       election.name = args.name ; 
       election.univ = args.univ ;
       election.startDate =  electionStartDate;
       election.endDate = electionEndDate ;


      // 기존 후보자 삭제하는 부분
      await this.deleteCandidateResults(ctx, election.electionId);

      // 후보자 등록하는 부분

      await this.generateCandidateResult(ctx , "기권" , election.electionId);
      
      for(var i in args.candidates){
        await this.generateCandidateResult(ctx ,args.candidates[i] , election.electionId);
      }

       await ctx.stub.putState(election.electionId, Buffer.from(JSON.stringify(election)));
      
       if(await this.myAssetExists(ctx, election.electionId)){
        let response = {};
        response.electionid = election.electionId;
        return response;

       } else{
         let response = {};
         response.error = "원장에 헌재 선거가 존재하지 않습니다. 실행도중 삭제 된것 같습니다";
         return response;
       }



     } else {
      let response = {};
      response.error = '수정하려는 선거 시작시간을 현재시간 기준으로 3일 이후로 지정해야합니다.';
      return response;
      }
    } else {
      let response = {};
      response.error = '해당 선거가 존재하지 않습니다.';
      return response;
    }
  
  } else {
    let response = {};
    response.error = '정상적이지 않은 입력입니다!'+ args + args.name+ args.univ +args.startdate +args.enddate;
    return response;
  }


}
// 선거삭제  args로 선거 아이디
async deleteElection(ctx, args) {
      
  args = JSON.parse(args);

  let electionExists = await this.myAssetExists(ctx, args.electionId);

  if (electionExists) {

  //make sure we have an election
    await this.deleteCandidateResults(ctx, args.electionId);

    await this.deleteMyAsset(ctx, args.electionId);
    
    let response = {};
    response.success = '해당 선거와 선거후보자를 모두 제거하였습니다.';
    return response;

  } else {
    let response = {};
    response.error = '해당 선거가 존재하지 않습니다.';
    return response;
    }
}


// 후보자들을 삭제하는 함수
async deleteCandidateResults(ctx, electionId) {
  let queryResults = await this.queryByObjectTypeReturnList(ctx, "candidateResult");
  for(var i in queryResults){
    if (queryResults[i].Record.electionId === electionId){
      await this.deleteMyAsset(ctx, queryResults[i].Key);
    }
  }      
}

/*

 후보자 생성하는 함수
args 
*/

async createCandidateResult(ctx, args) {
  
  args = JSON.parse(args);

  let election = JSON.parse(await this.readMyAsset(ctx, 'args.electionId'));

  if (election) {
    let response = {};
    response.error = '선거를 먼저 등록해 주세요.';
    return response;
  }
 //선거 시작 전에만 수정할 수 있음 [&& !(await this.validateEndDate(election.endDate))] 제거
  if (await this.validatePreviousDate(election.startDate)){
    //create a new voter
     let candidateId = await this.generateCandidateResult(ctx ,args.name , args.electionId);
     let response = {};
     response.success = candidateId;
    return response;



  } else {
    let response = {};
    response.error = "현재 선거가 진행중입니다.";
    return response;

  }
}


async generateCandidateResult(ctx , name, electionId) {

  //generate ballot
  let candidateResult = await new CandidateResult(name, electionId);


  // //update state with ballot object we just created
  await ctx.stub.putState(candidateResult.candidateId, Buffer.from(JSON.stringify(candidateResult)));

  return candidateResult.candidateId;

}

/**
   *
   * createVBallot
   *
   * VBallot 생성함수입니다.
   *  
   * @param args.election - 객체 형태, [ elctionId, name, univ,startdate,enddate ]
   * @param args.walletId - 학번+해쉬(비번) => walletid(app상에서 책정)
   * @returns - nothing - but updates the world state with a voter
   */
  async createVBallot(ctx, args) {

    args = JSON.parse(args);
    let election = await this.readMyAsset(ctx, args.electionId);

    if (await this.validateAfterDate(election.startDate) && await this.validatePreviousDate(election.endDate)) {

        let vBallot = await new VBallot(args.walletId, election);

     //update state with new VBallot
        await ctx.stub.putState(vBallot.voterId, Buffer.from(JSON.stringify(vBallot)));

        let response = {};
        response.success = '선거 : '+args.election.name + ' 에 대한 VBallot 생성완료 \n ';
                         // +'voterId는 ' + vBallot.voterId + ' 입니다.' ;
        return response;
      
    } else {
        let response = {};
        response.error = '선거기간이 아닙니다!';
        return response;
    }
    
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
   * @param candidateId - the Id of the candidate the voter has selected.
   * @returns an array which has the winning briefs of the ballot. 
  학생05: 후보자에게 투표한다
   */
  async castVote(ctx, args) {
    args = JSON.parse(args);

    //get the political party the voter voted for, also the key
    let candidateId = args.candidateId;

    //check to make sure the election exists 
    let vBallot = await this.readMyAsset(ctx, args.voterId);

    if (await this.validateAfterDate(vBallot.election.startDate) && await this.validatePreviousDate(vBallot.election.endDate)) {
      //let vBallot = await this.readMyAsset(ctx, args.voterId);

      console.log(candidateId);

      if ((vBallot.picked != "NULL")) {
        let response = {};
        response.error = '이미 '+ election.name +' 선거를 진행하셨습니다.';
        return response;
      }

        let candidateExists = await this.myAssetExists(ctx,candidateId);
        if (!candidateExists) {
          let response = {};
          response.error = '선택하신 후보자가 존재하지 않습니다!';
          return response;
        }

        //get the candidate object from the state - with the Candidate the user picked //candidateId 안맞으면 뻑날수 있음
        let candidateAsBytes = await ctx.stub.getState(candidateId);
        let candidate = await JSON.parse(candidateAsBytes);

        //increase the vote of the political party that was picked by the voter
        await candidate.count++;

        //update the state with the new vote count
        let result = await ctx.stub.putState(candidateId, Buffer.from(JSON.stringify(candidate)));
        console.log(result);

        //make sure this voter cannot vote again! 이름이 들어가게 수정
        vBallot.picked = candidate.name;

        //update state to say that this voter has voted, and who they picked
        let response = await ctx.stub.putState(vBallot.voterId, Buffer.from(JSON.stringify(vBallot)));
        console.log(response);

        return vBallot;

    } else {
      let response = {};
      response.error = '현재 선거 기간이 아닙니다';
      return response;
    }
  }


 // 데이터가 비어있는지만 체크하기 위한 함수
  async validate(input) {
    //VoterId error checking here, i.e. check if valid drivers License, or state ID
    if (input) {
      return true;
    } else {
      return false;
    }
  }

 // 현재 선거가 이전인지 확인하는 함수 - 주어진 시간보다 현재시간이 작으면 트루
 async validatePreviousDate(startDate) {
  let currentTime = await new Date();
  if (startDate > currentTime) {
    return true;
  } else {
    return false;
  }
}

 // 현재 선거기간 이후인지 확인하는 함수 - 주어진 시간 보다 현재 시간이 크면 트루
 async validateAfterDate(endDate) {
  let currentTime = await new Date();
  if (endDate <= currentTime) {
    return true;
  } else {
    return false;
  }
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
      response.error = `조회를 요청하신 ID:${myAssetId} 에 해당하는 데이터가 없습니다. 먼저 생성해 주세요`;
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




 // 값을 배열로 리턴~~~~~~~~~!!!!!!!!
    async queryWithQueryStringReturnList(ctx, queryString) {

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
          return allResults;
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


  async queryByObjectTypeReturnList(ctx, objectType) {

    let queryString = {
      selector: {
        type: objectType
      }
    };

    let queryResults = await this.queryWithQueryStringReturnList(ctx, JSON.stringify(queryString));
    return queryResults;

  }


 // 보터 아이디에 해당하는 투표 결과를 리턴 readmyAsset 과 기능이 같아서 미사용
 /*
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
  */

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

