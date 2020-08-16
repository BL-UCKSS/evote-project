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
let Student = require('./Student.js');
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
      response.error = '값이 비어있는 인자가 있습니다';
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
        await this.generateCandidateResult(ctx ,args.candidates[i], election.electionId);
      }

       await ctx.stub.putState(election.electionId, Buffer.from(JSON.stringify(election)));
      
       if(await this.myAssetExists(ctx, election.electionId)){
        let response = {};
        response.success = election.electionId;
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
  let response = {};
    response.success = '해당 선거후보자를 모두 제거하였습니다.';
    return response;      
}

/*

 후보자 생성하는 함수
args 
*/

async createCandidateResult(ctx, args, electionId) {
  
  args = JSON.parse(args);

  let election = await this.readMyAsset(ctx, electionId);

  if (election) {
    let response = {};
    response.error = '선거를 먼저 등록해 주세요.';
    return response;
  }
 //선거 시작 전에만 수정할 수 있음 [&& !(await this.validateEndDate(election.endDate))] 제거
  if (await this.validatePreviousDate(election.startDate)){
    //create a new voter
     let candidateId = await this.generateCandidateResult(ctx , args, electionId);
     let response = {};
     response.success = candidateId;
    return response;

  } else {
    let response = {};
    response.error = "현재 선거가 진행중입니다.";
    return response;

  }
}


/*getCandidateInfo
선거에 해당하는 후보자 조회 함수

*/

async getCandidateInfo(ctx, electionId) {
  let queryResults = await this.queryByObjectTypeReturnList(ctx, "candidateResult");
  let Results = [];
  for(var i in queryResults){
    if (queryResults[i].Record.electionId === electionId){
      Results.push(queryResults[i]);
    }
  }
  let response = {};
  response.success = Results;
  return response;     
}





/*
   updateCandidate 후보자 수정함수
*/
async updateCandidate(ctx, args, electionId) {
  
  args = JSON.parse(args);
  let electionExists = await this.myAssetExists(ctx, electionId);
  if (electionExists) {
    let CandidateResult = await this.readMyAsset(ctx, args.candidateId);
    let election = await this.readMyAsset(ctx, electionId);
 //선거 시작 전에만 수정할 수 있음 [&& !(await this.validateEndDate(election.endDate))] 제거
    if (await this.validatePreviousDate(election.startDate)){
    //create a new voter
     
      CandidateResult.name = args.name;
      CandidateResult.electionId = electionId;
      CandidateResult.link=args.link;
      CandidateResult.hakbun1= args.hakbun1;
      CandidateResult.name1=args.name1;
      CandidateResult.dept1=args.dept1;
      CandidateResult.grade1=args.grade1;
      CandidateResult.hakbun2=args.hakbun2;
      CandidateResult.name2=args.name2;
      CandidateResult.dept2 =args.dept2;
      CandidateResult.grade2=args.grade2;
      await ctx.stub.putState(CandidateResult.candidateId, Buffer.from(JSON.stringify(CandidateResult)));

      let response = {};
      response.success = CandidateResult.candidateId;
      return response;
    
    } else {
      let response = {};
       response.error = "현재 선거가 진행중입니다.";
      return response;

    }

  } else {
    let response = {};
    response.error = '선거를 먼저 등록해 주세요.';
    return response;
  }
  
}

//내부함수
async generateCandidateResult(ctx ,  args , electionId) {
  let candidateResult;
  if (args ==="기권"){
    candidateResult = await new CandidateResult( args, electionId , "NULL" ,"NULL", "NULL", "NULL" ,
    "NULL" ,  "NULL", "NULL" , "NULL", "NULL" , "NULL"  , "NULL" , "NULL" );
  } else {
    candidateResult = await new CandidateResult( args.name, electionId , args.icon ,args.link, args.hakbun1, args.name1 ,
      args.dept1 ,  args.grade1, args.profile1 , args.hakbun2 , args.name2 , args.dept2  ,  args.grade2 , args.profile2 );
  }
  //generate ballot


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
        await this.enrollVBallot(ctx, args.walletId ,vBallot.voterId);
        let response = {};
        response.success = vBallot.voterId;
        return response;
      
    } else {
        let response = {};
        response.error = '선거기간이 아닙니다!';
        return response;
    }
    
  }


 // student에 vBallot 등록 ->> 왜이렇게 하드코딩했냐면 일정 개수를 넘지 않기 위해.>.?? 나중에 리턴은 같지만 내부는 다르게 수정할수 있음
  async enrollVBallot(ctx, walletId ,voterId) {
 // student 존재하는지 확인해보고 없으면 초기화
    let student;
    let studentExists = await this.myAssetExists(ctx, walletId);
    if(!studentExists){
      student = await new Student(walletId);

    } else {
      student = await this.readMyAsset(ctx, walletId);
    }

    if (student.slot1 === "NULL") {
      student.slot1 = voterId
      await ctx.stub.putState(student.walletId, Buffer.from(JSON.stringify(student)));
      let response = {};
      response.success = '해당 walletId에 slot1의 VBallot이 할당되었습니다.';
      return response;
 
    }else if (student.slot2 === "NULL"){
      student.slot2 = voterId
      await ctx.stub.putState(student.walletId, Buffer.from(JSON.stringify(student)));
      let response = {};
      response.success = '해당 walletId에 slot2의 VBallot이 할당되었습니다.';
      return response;

    } else if (student.slot3 === "NULL"){
      student.slot3 = voterId
      await ctx.stub.putState(student.walletId, Buffer.from(JSON.stringify(student)));
      let response = {};
      response.success = '해당 walletId에 slot3의 VBallot이 할당되었습니다.';
      return response;

    } else if (student.slot4 === "NULL"){
      student.slot4 = voterId
      await ctx.stub.putState(student.walletId, Buffer.from(JSON.stringify(student)));
      let response = {};
      response.success = '해당 walletId에 slot4의 VBallot이 할당되었습니다.';
      return response;

    } else {
        let response = {};
        response.error = '선거가 모두 등록되었습니다. 등록된 선거수를 확인해보세요';
        return response;
    }
    
  }

  /*
  다중 객체 리턴
  */
  async checkMyVBallot(ctx, walletId) {
    // student 존재하는지 확인해보고 없으면 초기화
      let student = await this.readMyAsset(ctx, walletId);
      if(!student){
        let response = {};
        response.error = "진행한 투표가 없습니다.";
        return response;
      }
      let queryResults= [];
   
       if (student.slot1 !== "NULL") {
         let vBallot1 = await this.readMyAsset(ctx, student.slot1);
         let reVBallot1 ={};
          reVBallot1.voterId = student.slot1; //동규가 추가함
          reVBallot1.election = vBallot1.election;
          reVBallot1.picked = vBallot1.picked;
         queryResults.push(reVBallot1);
       }else if (student.slot2 !== "NULL"){
        let vBallot2 = await this.readMyAsset(ctx, student.slot2);
        let reVBallot2 ={};
        reVBallot2.voterId = student.slot2; //동규가 추가함
        reVBallot2.election = vBallot2.election;
        reVBallot2.picked = vBallot2.picked;
        queryResults.push(reVBallot2);
   
       } else if (student.slot3 !== "NULL"){
        let vBallot3 = await this.readMyAsset(ctx, student.slot3);
        let reVBallot3 ={};
        reVBallot3.voterId = student.slot3; //동규가 추가함
        reVBallot3.election = vBallot3.election;
        reVBallot3.picked = vBallot3.picked;
        queryResults.push(reVBallot3);
   
       } else if (student.slot4 !== "NULL"){
        let vBallot4 = await this.readMyAsset(ctx, student.slot4);
        let reVBallot4 ={};
        reVBallot4.voterId = student.slot4; //동규가 추가함
        reVBallot4.election = vBallot4.election;
        reVBallot4.picked = vBallot4.picked;
        queryResults.push(reVBallot4);
   
       } else {
           let response = {};
           response.error = '정상적이지 않은 student 객체생성이 감지되었습니다.';
           return response;
       }
       let response = {};
       response.success = queryResults;
       return response;
      
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
   * args {"voterId":"" ,"candidateId":""}
  학생05: 후보자에게 투표한다
   */
  async castVote(ctx, args) {
    args = JSON.parse(args);

    //get the political party the voter voted for, also the key
    let candidateId = args.candidateId;

    //동규가 추가함
    let univ = args.univ;
    let myBallot = await this.checkMyVBallot(ctx, args.walletId);
    let voterId;
    for(let i=0; i<myBallot.success.length; i++){
      if(myBallot.success[i].election.univ === univ){
        voterId = myBallot.success[i].voterId;
        break;
      }
    }

    // 동규가 수정함. args.voterId => voterId 로 변경함
    //check to make sure the election exists 
    let vBallot = await this.readMyAsset(ctx, voterId);

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
      await ctx.stub.putState(candidateId, Buffer.from(JSON.stringify(candidate)));

      //make sure this voter cannot vote again! 이름이 들어가게 수정
      vBallot.picked = candidate.name;

      //update state to say that this voter has voted, and who they picked
      await ctx.stub.putState(vBallot.voterId, Buffer.from(JSON.stringify(vBallot)));

      let response = {};
      response.success = vBallot.voterId;
      return response;
        
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
  let targetTime = await new Date(startDate);
  let currentTime = await new Date();
  if (targetTime > currentTime) {
    return true;
  } else {
    return false;
  }
}

 // 현재 선거기간 이후인지 확인하는 함수 - 주어진 시간 보다 현재 시간이 크면 트루
 async validateAfterDate(endDate) {
  let targetTime = await new Date(endDate);
  let currentTime = await new Date();
  if (targetTime <= currentTime) {
    return true;
  } else {
    return false;
  }
}

/*
15. 재학생이 완료된 선거의 결과를 확인한다. -> 선거별로 후보자 득표수를 리스트로 리턴한다.
후보자의 결과를 리스트로 리턴   ==>> 리턴값을 Json으로 바꿀 ㅅ 있나>>>
electionId
*/
async queryCandidateResults(ctx, electionId) {

  const election = await this.readMyAsset(ctx, electionId);
  let name = [];
  let count = []; 

  name.push("voteNum" );
  count.push(0);

  let queryResults = await this.queryByObjectTypeReturnList(ctx, "candidateResult");
  for(var i in queryResults){
    if (queryResults[i].Record.electionId === election.electionId){
      name.push(queryResults[i].Record.name);
      count.push((queryResults[i].Record.count));
      count[0] = count[0]+ (queryResults[i].Record.count);
      }
    }
    let result = {
      "name": name,
      "count":count
    };
  return result;
}



/*5. 선거 관리자가 선거별 투표율을 조회한다.(실시간으로 선거별 투표수 / 재학생 수 * 100) 
args - {"electionId":"dsff", "TotalNum":int}
*/

async queryCurrentTimeTurnout(ctx, args) {

  const election = await this.readMyAsset(ctx, args.electionId);
  let currentTimeTurnout;
  let candidateResults = await this.queryCandidateResults(ctx, election.electionId);
  if(election.univ == "총학생회") {
    var TotalNum = args.totalNum;
  } else {
    var TotalNum = args.deptNum;
  }
  if(TotalNum !== 0){
    currentTimeTurnout = (candidateResults.count[0])/TotalNum*100;
    } else {
      let response = {};
      response.error = '주어진 총 학생수가 0입니다.';
      return response;
    }

    let response = {};
    response.success = currentTimeTurnout;
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

