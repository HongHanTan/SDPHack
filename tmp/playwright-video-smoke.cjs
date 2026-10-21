process.env.PLAYWRIGHT_BROWSERS_PATH=require('node:path').resolve('tmp/playwright-browsers');
const {chromium}=require('./playwright-tools/node_modules/playwright');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:false,executablePath:path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1187/chrome-win/chrome.exe')});
 const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:path.resolve('output/recorded-walkthrough/encoder-check'),size:{width:1600,height:900},fps:15}});
 const page=await context.newPage();
 await page.goto('http://localhost:5173',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.waitForTimeout(2000);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.waitForTimeout(1000);
 const video=page.video();
 await context.close();
 await video.saveAs(path.resolve('output/recorded-walkthrough/encoder-check/verified.webm'));
 console.log('VERIFIED_VIDEO_BYTES',fs.statSync('output/recorded-walkthrough/encoder-check/verified.webm').size);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
