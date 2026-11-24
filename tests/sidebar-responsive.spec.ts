import {test,expect,Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

const fixture=JSON.parse(readFileSync('tests/fixtures/ui.json','utf8'));
async function setup(page:Page){
 await page.route('**/__scout_fixture',route=>route.fulfill({json:fixture}));
 await page.addInitScript(()=>{
  (window as any).__TAURI_INTERNALS__={invoke:async(command:string)=>{
   if(command==='recent_saves')return ['/fixtures/example.fm'];
   if(command==='load_save')return fetch('/__scout_fixture').then(r=>r.json());
   if(command==='load_preferences')return null;
   throw new Error('Unexpected command '+command);
  }};
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Load FM24 save',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Player scouting',exact:true})).toBeVisible();
}
async function expectContained(page:Page){
 const dimensions=await page.locator('aside').evaluate(el=>({width:el.clientWidth,content:el.scrollWidth}));
 expect(dimensions.content).toBeLessThanOrEqual(dimensions.width+1);
 expect(await page.locator('body').evaluate(el=>el.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test('sidebar remains usable at narrow widths and short heights',async({page},testInfo)=>{
 await setup(page);
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:650,height:360},{width:1024,height:480}]){
  await page.setViewportSize(viewport);
  await expectContained(page);
  const clippedText=await page.locator('aside').evaluate(root=>[...root.querySelectorAll<HTMLElement>('button,summary,label,legend,p')].filter(el=>el.clientWidth>0 && (el.scrollWidth>el.clientWidth+1 || el.scrollHeight>el.clientHeight+1)).map(el=>el.textContent?.trim()));
  expect(clippedText).toEqual([]);
  const search=page.getByLabel('Search players',{exact:true});
  await search.fill('Alex');
  await page.getByRole('button',{name:'Apply filters',exact:true}).click();
  await expect(page.locator('.results tbody tr[aria-label]')).toHaveCount(1);
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();
  await expect(page.locator('.results tbody tr[aria-label]')).toHaveCount(6);
 }
 await page.screenshot({path:testInfo.outputPath('sidebar-short.png'),fullPage:true});
});

test('sidebar supports doubled text without losing controls or content',async({page},testInfo)=>{
 await setup(page);
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  await page.locator('aside').evaluate(root=>{
   const elements=[root,...root.querySelectorAll<HTMLElement>('*')];
   const sizes=elements.map(el=>parseFloat(getComputedStyle(el).fontSize));
   elements.forEach((el,index)=>el.style.fontSize=`${sizes[index]*(el.dataset.scaled ? 1 : 2)}px`);
   elements.forEach(el=>el.dataset.scaled='true');
  });
  await expectContained(page);
  const clippedText=await page.locator('aside').evaluate(root=>[...root.querySelectorAll<HTMLElement>('button,summary,label,legend,p')].filter(el=>el.clientWidth>0 && (el.scrollWidth>el.clientWidth+1 || el.scrollHeight>el.clientHeight+1)).map(el=>el.textContent?.trim()));
  expect(clippedText).toEqual([]);
  const search=page.getByLabel('Search players',{exact:true});
  await search.fill('Alex');
  await expect(search).toBeFocused();
  const searchBox=(await search.boundingBox())!,actionsBox=(await page.locator('.filter-actions').boundingBox())!;
  expect(searchBox.y+searchBox.height).toBeLessThanOrEqual(actionsBox.y+1);
  await page.getByRole('button',{name:'Apply filters',exact:true}).click();
  await expect(page.locator('.results tbody tr[aria-label]')).toHaveCount(1);
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();
  await page.getByLabel('Search players',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath(`sidebar-text-200-${viewport.width}.png`),fullPage:true});
 }
});

test.describe('touch sidebar',()=>{
 test.use({hasTouch:true,viewport:{width:390,height:844}});
 test('supports native touch scrolling, cancellation, and filter taps',async({page,context},testInfo)=>{
  await setup(page);
  for(const control of [page.getByRole('button',{name:'Staff',exact:true}),page.getByLabel('Search name',{exact:true}),page.getByRole('button',{name:'Reset filters',exact:true})]){
   expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const form=page.locator('aside form');
  await form.scrollIntoViewIfNeeded();
  const box=(await form.boundingBox())!;
  const client=await context.newCDPSession(page);
  const startY=Math.min(box.y+box.height-120,700),x=box.x+box.width/2;
  const before=await form.evaluate(el=>el.scrollTop);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]});
  for(let step=1;step<=8;step++){
   await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:startY-step*20}]});
   await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>form.evaluate(el=>el.scrollTop)).toBeGreaterThan(before+80);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  const gk=page.getByRole('button',{name:'GK',exact:true});
  await gk.tap();
  await expect(gk).toHaveAttribute('aria-pressed','true');
  expect((await gk.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button',{name:'Apply filters',exact:true}).tap();
  await expect(page.locator('.results tbody tr[aria-label]')).toHaveCount(1);
  await expect(page.getByRole('row',{name:'Open Sam Keeper',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reset filters',exact:true}).tap();
  await expect(gk).toHaveAttribute('aria-pressed','false');
  await page.screenshot({path:testInfo.outputPath('sidebar-touch.png'),fullPage:true});
 });
});
