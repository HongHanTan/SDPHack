const {chromium}=require('./playwright-tools/node_modules/playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:false,executablePath:path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1187/chrome-win/chrome.exe'),args:['--window-position=30,30','--window-size=1640,1040']});
 const context=await browser.newContext({viewport:{width:1600,height:900},storageState:path.resolve('output/recorded-walkthrough/demo-browser-state.json')});
 const page=await context.newPage();
 await page.goto('http://localhost:5173',{waitUntil:'networkidle'});
 const player=await context.newPage();
 await player.goto(require('node:url').pathToFileURL(path.resolve('output/recorded-walkthrough/Watch-walkthrough.html')).href);
 await player.locator('video').waitFor();
 await player.waitForFunction(()=>document.querySelector('video').readyState>=1);
 console.log('VIDEO_PLAYER_READY',await player.locator('video').evaluate(video=>({duration:video.duration,width:video.videoWidth,height:video.videoHeight})));
 await page.bringToFront();
 console.log('VISIBLE_DEMO_BROWSER_READY - synthetic recorded case restored. Close this browser when finished.');
 await new Promise(resolve=>browser.once('disconnected',resolve));
})().catch(e=>{console.error(e);process.exit(1);});
