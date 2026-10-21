const {chromium}=require('./playwright-tools/node_modules/playwright');const path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:false,executablePath:path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1187/chrome-win/chrome.exe'),args:['--window-position=25,25','--window-size=1640,1040']});
 const context=await browser.newContext({viewport:{width:1600,height:900},storageState:path.resolve('output/site-onboarding-demo/browser-state.json')});
 const start=await context.newPage();await start.goto('http://localhost:5173');
 const site=await context.newPage();await site.goto('http://localhost:5173');await site.locator('.site-project-cards button').filter({hasText:'Riverside Estate drainage review'}).first().click();await site.waitForTimeout(2600);
 const player=await context.newPage();await player.goto(pathToFileURL(path.resolve('output/site-onboarding-demo/Watch-upload-walkthrough.html')).href);await player.locator('video').evaluate(v=>new Promise((resolve,reject)=>{if(v.readyState>=1)return resolve();v.onloadedmetadata=resolve;v.onerror=()=>reject(new Error('Video could not load'));}));
 console.log('PLAYER',await player.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight})));
 await player.getByRole('button',{name:/8\. Test one physical change/}).click();await player.waitForTimeout(1200);await player.locator('video').evaluate(v=>v.pause());
 await player.screenshot({path:'output/site-onboarding-demo/player-preview.png'});await start.bringToFront();console.log('READY — upload page, saved site and chapter player are open.');
 setInterval(()=>{},60000);
})().catch(e=>{console.error(e);process.exitCode=1;});
