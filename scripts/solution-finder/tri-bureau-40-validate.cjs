const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{pathToFileURL}=require("node:url"),{chromium}=require("playwright");
const {RESULTS,INPUT,SOURCE,hash}=require("./tri-bureau-40.cjs");
async function validate(){
 const summary=JSON.parse(fs.readFileSync(path.join(RESULTS,"summary.json"))),fixture=JSON.parse(fs.readFileSync(INPUT)),stage=summary.counts.attempted===40?"final":"preflight",directory=path.join(RESULTS,"validation",stage);fs.mkdirSync(directory,{recursive:true});
 assert.equal(hash(SOURCE),summary.sourceSha256,"Workbook unchanged");
 const emails=new Set(),ids=new Set();let screenshots=0,referenceCount=0,actualSubmissions=0;
 for(const p of summary.profiles.filter(p=>p.attempted)){
  for(const ref of Object.values(p.refs)){const f=path.resolve(RESULTS,ref);assert.ok(f.startsWith(RESULTS+path.sep),`${p.id} evidence routing`);assert.ok(fs.statSync(f).size>0,`${p.id} existing nonempty reference`);referenceCount++;}
  const image=path.join(RESULTS,p.refs["offers.png"]??"");assert.ok(p.refs["offers.png"],`${p.id} screenshot recorded`);assert.equal(fs.readFileSync(image).subarray(0,8).toString("hex"),"89504e470d0a1a0a",`${p.id} PNG signature`);screenshots++;
  if(p.submitted){const sub=JSON.parse(fs.readFileSync(path.join(RESULTS,p.refs["submission.json"])));assert.equal(sub.count,1,`${p.id} exactly one POST`);actualSubmissions+=sub.count;assert.equal(sub.url,"https://falcon.qa.fsp.rate.com/api/application/inquiry");
   const req=sub.actualRequest.applicationInquiryInput,wanted=fixture.profiles.find(q=>q.id===p.id).request.applicationInquiryInput;
   assert.ok(JSON.stringify(req.basicInfoInput.name)===JSON.stringify(wanted.basicInfoInput.name),`${p.id} actual submitted exact name`);assert.ok(JSON.stringify(req.basicInfoUpdateInput)===JSON.stringify(wanted.basicInfoUpdateInput),`${p.id} actual DOB and SSN suffix`);
   for(const key of ["street","city","region","postalCode","country"])assert.ok(JSON.stringify(req.basicInfoInput.residenceAddress[key])===JSON.stringify(wanted.basicInfoInput.residenceAddress[key]),`${p.id} residence ${key}`);
   assert.equal(req.propertyInputHeloc.type,"SECONDARY");assert.equal(req.propertyInputHeloc.requestedLoanAmount,50000);assert.equal(req.existingMortgageAmount,70000);assert.equal(req.incomeInput[0].annualIncome,250000);assert.equal(req.incomeInput[0].incomeSource,"EMPLOYED_FULL_TIME");
   assert.ok(!emails.has(req.basicInfoInput.emailId),`${p.id} fresh email`);emails.add(req.basicInfoInput.emailId);
  }
  if(p.inquiryId){assert.ok(!ids.has(p.inquiryId),`${p.id} independent inquiry ID`);ids.add(p.inquiryId);}
 }
 const browser=await chromium.launch({headless:true});let renderedImages=0;
 try{const page=await browser.newPage({viewport:{width:1440,height:1100}});await page.goto(pathToFileURL(path.join(RESULTS,"index.html")).href);assert.equal(await page.title(),"GRI Tri-Bureau 40");
  const images=page.locator("img");assert.equal(await images.count(),screenshots);
  renderedImages=await images.evaluateAll(async imgs=>{for(const img of imgs){img.loading="eager";await img.decode();if(!img.naturalWidth)throw Error("Image not viewable");}return imgs.length;});
  await page.screenshot({path:path.join(directory,"report-overview.png"),fullPage:false});
  const positive=summary.offerPositiveIds[0];if(positive){await page.locator("#"+positive).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,"offer-positive-section.png"),fullPage:false});}
 }finally{await browser.close();}
 const result={stage,sourceUnchanged:true,attempted:summary.counts.attempted,actualSubmissions,uniqueInquiryIds:ids.size,uniqueEmails:emails.size,screenshots,renderedImages,referenceCount,status:"PASS",at:new Date().toISOString()};fs.writeFileSync(path.join(directory,"validation.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
validate().catch(e=>{const d=path.join(RESULTS,"validation");fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,"validation-error.json"),JSON.stringify({message:e.message,stack:e.stack},null,2));console.error("Validation failed; inspect restricted validation-error.json.");process.exitCode=1;});
