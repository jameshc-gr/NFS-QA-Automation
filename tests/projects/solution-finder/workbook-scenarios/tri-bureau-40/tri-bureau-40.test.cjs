const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),XLSX=require("xlsx");
const {INPUT,SOURCE,ROOT,hash,digits,ficoComparison,discovery,labelingIssues}=require("../../../../../scripts/solution-finder/tri-bureau-40.cjs");
const {profileTableRows,offerStatus,SOURCE_COLUMNS}=require("../../../../../scripts/solution-finder/tri-bureau-40.cjs");
test("leading zeros and invalid normalization",()=>{assert.equal(digits("012-34-5678",9),"012345678");assert.equal(digits("12345678",9),"012345678");assert.equal(digits("1234",5),"01234");assert.throws(()=>digits("invalid",9));assert.throws(()=>digits("1234567890",9));});
test("all 40 preserve exact workbook identities and fixed independent setup",{skip:!fs.existsSync(SOURCE) && "Restricted source workbook not installed; pure/normalized tests remain available"},()=>{
 const f=JSON.parse(fs.readFileSync(INPUT)),rows=XLSX.utils.sheet_to_json(XLSX.readFile(SOURCE).Sheets.Sheet1,{header:1,raw:false,defval:""}),base=JSON.parse(fs.readFileSync(path.join(ROOT,"test-data/solution-finder/workbook-scenarios/original-scenarios.json"))).scenarios[0].request;
 assert.equal(f.profiles.length,40);assert.equal(new Set(f.profiles.map(p=>p.id)).size,40);assert.equal(hash(SOURCE),f.sourceSha256);
 for(const [i,p]of f.profiles.entries()){const a=p.request.applicationInquiryInput,r=rows[i+1];assert.ok(JSON.stringify(a.basicInfoInput.name)===JSON.stringify({first:r[0],middle:r[1],last:r[2],suffix:""}),`${p.id} exact name preservation`);assert.ok(JSON.stringify(a.basicInfoInput.residenceAddress)===JSON.stringify({street:[r[3]],city:r[4],region:r[5],postalCode:digits(r[6],5),country:"US"}),`${p.id} exact residence preservation`);assert.ok(a.basicInfoUpdateInput.lastFourSSN===digits(r[7],9).slice(-4),`${p.id} suffix preservation`);assert.equal(a.basicInfoUpdateInput.dateOfBirth,"1980-01-01");assert.equal(a.propertyInputHeloc.type,"SECONDARY");assert.ok(JSON.stringify(a.propertyInputHeloc.address)===JSON.stringify(base.applicationInquiryInput.propertyInputHeloc.address));assert.equal(a.propertyInputHeloc.requestedLoanAmount,50000);assert.equal(a.existingMortgageAmount,70000);assert.equal(a.incomeInput[0].annualIncome,250000);assert.equal(a.incomeInput[0].incomeSource,"EMPLOYED_FULL_TIME");assert.equal(p.workbookRow,i+2);assert.ok(!JSON.stringify(p).includes(digits(r[7],9)),"Full SSN not retained");}
});
test("FICO only compares returned bureau scores",()=>{const a=ficoComparison({TU:750,XPN:760,EFX:740},{TU:750,EX:759});assert.deepEqual(a.map(v=>v.status),["PASS","FAIL","NOT_COMPARABLE"]);assert.equal(ficoComparison({TU:null,XPN:null,EFX:null},{EX:750})[1].status,"NOT_COMPARABLE");});
test("discovery separates eligible, denial and missing/invalid",()=>{assert.equal(discovery(null),"blocked-error");assert.equal(discovery({offers:[{loanAmount:null}]}),"blocked-error");assert.equal(discovery({offers:[{loanAmount:null,ineligibleReasons:["No credit match"]}]}),"no eligible offers");assert.equal(discovery({offers:[{loanAmount:50000}]}),"offers found");});

test("Figure HELOC is not silently relabeled HELOAN",()=>{assert.equal(labelingIssues([{applicationType:"FIGURE_HELOC",productType:"HELOAN"}]).length,1);assert.equal(labelingIssues([{applicationType:"FIGURE_HELOC",productType:"FIXED_RATE_HELOC"}]).length,0);});

function tableFixture(){
 const profiles=JSON.parse(fs.readFileSync(INPUT)).profiles;
 const source=[SOURCE_COLUMNS,...profiles.map(p=>{
  const a=p.request.applicationInquiryInput,n=a.basicInfoInput.name,r=a.basicInfoInput.residenceAddress;
  return[n.first,n.middle,n.last,r.street[0],r.city,r.region,r.postalCode,`00000${a.basicInfoUpdateInput.lastFourSSN}`,...["TU","XPN","EFX"].map(k=>p.bureau[k]??"N/A")];
 })];
 const summary={profiles:profiles.map((p,i)=>({
  id:p.id,workbookRow:i+2,submitted:true,httpStatus:200,inquiryId:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,
  actualFico:i===6?{TRANSUNION:null,EXPERIAN:null}:{TRANSUNION:750,EXPERIAN:760},
  allOffers:i===25?[
   {productType:"HELOAN",ineligibleReasons:["Controlled decline"]},
   {productType:"FIXED_RATE_HELOC",ineligibleReasons:["WAITING_FOR_INITIAL_OFFERS"]},
   {productType:"VARIABLE_RATE_HELOC",ineligibleReasons:["WAITING_FOR_INITIAL_OFFERS"]}
  ]:i<31?[{productType:"HELOAN",loanAmount:50000}]:[{productType:"HELOAN",ineligibleReasons:["Controlled decline"]}]
 }))};
 return{source,summary};
}

test("tabular results preserve all source columns and separate actual scores and eligibility",()=>{
 const {source,summary}=tableFixture(),rows=profileTableRows(source,summary);
 assert.equal(rows.length,40);assert.equal(rows.filter(r=>r["Credit score returned (Y/N)"]==="Y").length,39);
 assert.equal(rows[6]["Credit score returned (Y/N)"],"N");
 assert.equal(rows.filter(r=>r["Offers given (eligible)"]!=="None").length,30);
 for(const [i,row]of rows.entries())for(const [j,column]of SOURCE_COLUMNS.entries()){
  assert.ok(row[column]===(j===6?digits(source[i+1][j],5):j===7?digits(source[i+1][j],9):source[i+1][j]),`${row.Profile}: ${column} source value changed`);
 }
 assert.equal(rows[25]["Offers given (eligible)"],"None");
 assert.match(rows[25]["Declined / pending products"],/\[Pending\]: WAITING_FOR_INITIAL_OFFERS/);
 assert.equal(offerStatus({ineligibleReasons:["WAITING_FOR_INITIAL_OFFERS"]}),"Pending");
 assert.equal(offerStatus({loanAmount:50000}),"Eligible");
 assert.equal(offerStatus({ineligibleReasons:["Low score"]}),"Declined");
 const modified=structuredClone(summary);modified.profiles[0].actualFico={TRANSUNION:0};
 const invalidScore=profileTableRows(source,modified)[0];
 assert.equal(invalidScore["Credit score returned (Y/N)"],"N");assert.equal(invalidScore["Returned TU"],0);
});

test("tabular results reject missing, duplicated or misaligned profile evidence",()=>{
 const {source,summary}=tableFixture();
 assert.throws(()=>profileTableRows(source.slice(0,40),summary),/source layout/);
 assert.throws(()=>profileTableRows(source,{profiles:summary.profiles.slice(0,39)}),/40 unique/);
 const duplicate=structuredClone(summary);duplicate.profiles[1].id=duplicate.profiles[0].id;
 assert.throws(()=>profileTableRows(source,duplicate),/40 unique/);
 const missing=structuredClone(summary);missing.profiles[0].submitted=false;
 assert.throws(()=>profileTableRows(source,missing),/completed inquiry evidence missing/);
});
