process.env.PLAYWRIGHT_BROWSERS_PATH = require('node:path').resolve('tmp/playwright-browsers');
const { chromium } = require('./playwright-tools/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');

(async () => {
  const output = path.resolve('output/recorded-walkthrough');
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({
    headless:false,
    executablePath:path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1187/chrome-win/chrome.exe'),
    args:['--window-position=30,30','--window-size=1640,1040','--no-first-run'],
  });
  const context = await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:output,size:{width:1600,height:900}},acceptDownloads:true});
  const page = await context.newPage();
  const started = Date.now();
  const chapters = [];
  const errors = [];
  page.on('pageerror',error=>{errors.push(String(error));console.log('PAGE_ERROR',String(error));});
  page.on('download',async d=>{await d.saveAs(path.join(output,d.suggestedFilename()));console.log('DOWNLOAD',d.suggestedFilename());});
  const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const mark = async (title,detail='') => {
    const seconds=(Date.now()-started)/1000;
    chapters.push({seconds,title,detail});
    console.log('CHAPTER',JSON.stringify({seconds,title,detail}));
    await page.evaluate(({title,detail})=>{
      let el=document.getElementById('recording-caption');
      if(!el){el=document.createElement('div');el.id='recording-caption';el.style.cssText='position:fixed;bottom:12px;left:50%;transform:translateX(-50%);max-width:1100px;width:max-content;z-index:2147483647;pointer-events:none;background:rgba(15,28,45,.95);color:white;padding:12px 22px;border:1px solid #ffffff44;border-radius:10px;box-shadow:0 4px 24px #0004;font:14px/1.45 Arial,sans-serif;text-align:center';document.body.appendChild(el);}
      el.replaceChildren();const b=document.createElement('strong');b.textContent=title;b.style.cssText='display:block;font-size:17px;color:#fff';el.appendChild(b);const s=document.createElement('span');s.textContent=detail;el.appendChild(s);
    },{title,detail});
    await pause(1800);
  };
  const move = async locator => {
    await locator.scrollIntoViewIfNeeded();
    const box=await locator.boundingBox();
    if(box){await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:12});await page.evaluate(({x,y})=>{let el=document.getElementById('recording-pointer');if(!el){el=document.createElement('div');el.id='recording-pointer';el.style.cssText='position:fixed;width:20px;height:20px;border:3px solid #ef233c;background:#ef233c22;border-radius:100%;z-index:2147483647;pointer-events:none;transition:left .18s,top .18s';document.body.appendChild(el);}el.style.left=(x-10)+'px';el.style.top=(y-10)+'px';},{x:box.x+box.width/2,y:box.y+box.height/2});await pause(350);}
  };
  const click = async locator => {await move(locator);await locator.click();await pause(650);};
  const fill = async (locator,value) => {await move(locator);await locator.fill('');await locator.pressSequentially(value,{delay:18});await pause(200);};
  const select = async (locator,label) => {await move(locator);await locator.selectOption({label});await pause(450);};
  const shot = async name => {await page.screenshot({path:path.join(output,name+'.png')});console.log('SCREENSHOT',name);};
  const finish = async () => {
    await context.storageState({path:path.join(output,'demo-browser-state.json')});
    await page.screenshot({path:path.join(output,'final-dashboard.png')});
    const video=page.video();
    await context.close();
    await video.saveAs(path.join(output,'FloodOps-full-walkthrough.webm'));
    fs.writeFileSync(path.join(output,'chapters.json'),JSON.stringify(chapters,null,2));
    fs.writeFileSync(path.join(output,'page-errors.json'),JSON.stringify(errors,null,2));
    console.log('FINISHED',path.join(output,'FloodOps-full-walkthrough.webm'));
    await browser.close();
    process.exit(0);
  };
  const sandbox={page,context,browser,output,path,fs,pause,mark,click,fill,select,shot,finish,console};
  vm.createContext(sandbox);
  await page.goto('http://localhost:5173',{waitUntil:'networkidle'});
  await page.bringToFront();
  await page.waitForTimeout(2000);
  console.log('READY',JSON.stringify(await page.getByRole('button').allTextContents()));
  let active=false;
  http.createServer(async (request,response)=>{
    if(request.method!=='POST'||request.url!=='/action'){response.writeHead(404);response.end();return;}
    if(active){response.writeHead(409);response.end('Action running');return;}
    active=true;let body='';for await (const chunk of request)body+=chunk;
    try{const value=await vm.runInContext('(async()=>{'+JSON.parse(body).code+'})()',sandbox);response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ok:true,value:value??null}));console.log('RESULT',JSON.stringify(value??'ok'));}
    catch(error){console.log('ACTION_ERROR',String(error));await page.screenshot({path:path.join(output,'last-action-error.png')}).catch(()=>{});response.writeHead(500);response.end(JSON.stringify({error:String(error)}));}
    finally{active=false;}
  }).listen(8766,'127.0.0.1',()=>console.log('CONTROL_READY http://127.0.0.1:8766/action'));
})().catch(error=>{console.error(error);process.exit(1);});
