import {test,expect,Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

const fixture=JSON.parse(readFileSync('tests/fixtures/ui.json','utf8'));
async function setup(page:Page,data=fixture){
 await page.route('**/__scout_fixture',route=>route.fulfill({json:data}));
 await page.addInitScript(()=>{
  (window as any).__exports=[];
  (window as any).__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{
   if(command==='recent_saves'||command==='list_saves')return ['/fixtures/example.fm'];
   if(command==='choose_save')return '/fixtures/example.fm';
   if(command==='load_save')return fetch('/__scout_fixture').then(r=>r.json());
   if(command==='load_preferences')return null;
   if(command==='role_report')return {current:[],potential:[]};
   if(command==='export_csv'){(window as any).__exports.push(args);return '/fixtures/export.csv';}
   if(command==='quit_app')return;
   throw new Error('Unexpected command '+command);
  }};
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Load FM24 save',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Player scouting',exact:true})).toBeVisible();
}
const rows=(page:Page)=>page.locator('.results tbody tr[aria-label]');

test('positions follow a pitch and country follows position in the player table',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('foxy-columns-v2',JSON.stringify(['Club','Age','CA','PA','Diff','BestPos','MarketValue','SaleValue','ValueDifference'])));
 await setup(page);
 const positions=page.locator('.position-choices');
 const box=async(name:string)=>(await positions.getByRole('button',{name,exact:true}).boundingBox())!;
 const st=await box('ST'),aml=await box('AML'),amc=await box('AMC'),amr=await box('AMR'),mc=await box('MC'),dm=await box('DM'),dc=await box('DC'),gk=await box('GK');
 expect(st.y).toBeLessThan(aml.y);
 expect(aml.y).toBe(amc.y);expect(amc.y).toBe(amr.y);
 expect(aml.x).toBeLessThan(amc.x);expect(amc.x).toBeLessThan(amr.x);
 expect(amc.y).toBeLessThan(mc.y);expect(mc.y).toBeLessThan(dm.y);expect(dm.y).toBeLessThan(dc.y);expect(dc.y).toBeLessThan(gk.y);
 expect(st.x).toBe(gk.x);expect(st.x).toBe(amc.x);
 await expect(positions.getByRole('button')).toHaveCount(14);
 const headings=await page.locator('.results thead th button').allTextContents();
 const position=headings.findIndex(heading=>heading.includes('Position'));
 expect(headings[position+1]).toContain('Country');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByText('Keyboard shortcuts',{exact:true}).first().click();
 await page.getByLabel('Show keybind bar',{exact:true}).uncheck();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('navigation',{name:'Keyboard shortcuts',exact:true})).toHaveCount(0);
 await page.keyboard.press('?');
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
});
const saved=(page:Page)=>page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Saved searches/})});
async function openSaved(page:Page){
 const details=saved(page);
 if(await details.getAttribute('open')===null)await details.locator('summary').click();
 return details;
}

test('search Enter applies filters and shortcuts respect typing in both workspaces',async({page})=>{
 await setup(page);
 await page.locator('body').click({position:{x:800,y:50}});
 await page.keyboard.press('/');
 const search=page.getByLabel('Search players',{exact:true});
 await expect(search).toBeFocused();
 await search.fill('Alex');
 await search.press('Enter');
 await expect(rows(page)).toHaveCount(1);
 await expect(page.locator('.pending-label')).toHaveCount(0);
 await search.fill('j/k?');
 await search.press('Alt+s');
 await expect(search).toHaveValue('j/k?');
 await expect(page.getByRole('heading',{name:'Player scouting',exact:true})).toBeVisible();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await search.blur();
 await page.keyboard.press('Alt+s');
 await expect(page.getByRole('heading',{name:'Staff scouting',exact:true})).toBeVisible();
 await page.keyboard.press('Control+f');
 const staffSearch=page.getByLabel('Search staff',{exact:true});
 await expect(staffSearch).toBeFocused();
 await staffSearch.fill('Example');
 await staffSearch.press('Enter');
 await expect(rows(page)).toHaveCount(1);
 await expect(rows(page).first()).toHaveAttribute('aria-label','Open Example Coach');
 await staffSearch.blur();
 await page.keyboard.press('Alt+p');
 await expect(search).toHaveValue('j/k?');
});

test('keyboard browsing opens filtered profiles and returns to the list',async({page})=>{
 await setup(page);
 const search=page.getByLabel('Search players',{exact:true});
 await search.focus();
 await search.press('ArrowDown');
 await expect(rows(page).first()).toBeFocused();
 await page.keyboard.press('j');
 await expect(rows(page).nth(1)).toBeFocused();
 await page.keyboard.press('k');
 await expect(rows(page).first()).toBeFocused();
 const first=(await rows(page).first().getAttribute('aria-label'))!.replace(/^Open /,'');
 const second=(await rows(page).nth(1).getAttribute('aria-label'))!.replace(/^Open /,'');
 await page.keyboard.press('Space');
 await expect(page.getByRole('heading',{name:first,exact:true})).toBeVisible();
 await page.keyboard.press('Alt+ArrowRight');
 await expect(page.getByRole('heading',{name:second,exact:true})).toBeVisible();
 await page.keyboard.press('Alt+ArrowLeft');
 await expect(page.getByRole('heading',{name:first,exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('heading',{name:'Player scouting',exact:true})).toBeVisible();
});

test('plain Enter applies filters from the page and a result row without opening a report',async({page})=>{
 await setup(page);
 await page.getByLabel('Search players',{exact:true}).fill('Alex');
 await page.getByLabel('Search players',{exact:true}).blur();
 await page.keyboard.press('Enter');
 await expect(rows(page)).toHaveCount(1);
 await expect(page.locator('.pending-label')).toHaveCount(0);
 await page.getByLabel('Search players',{exact:true}).fill('Jo');
 await rows(page).first().focus();
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Player scouting',exact:true})).toBeVisible();
 await expect(rows(page).first()).toHaveAttribute('aria-label','Open Jo Midfielder');
 await rows(page).first().focus();
 await page.keyboard.press('Space');
 await expect(page.getByRole('heading',{name:'Jo Midfielder',exact:true})).toBeVisible();
});

test('row navigation crosses virtual windows and supports Home End and paging',async({page})=>{
 const data=structuredClone(fixture);
 data.players=Array.from({length:200},(_,i)=>({...fixture.players[0],UID:3000+i,Name:`Keyboard ${String(i).padStart(3,'0')}`}));
 await setup(page,data);
 await page.locator('.results thead th').first().getByRole('button').click();
 await page.getByLabel('Search players',{exact:true}).press('ArrowDown');
 await expect(page.getByRole('row',{name:'Open Keyboard 000',exact:true})).toBeFocused();
 await page.keyboard.press('End');
 await expect(page.getByRole('row',{name:'Open Keyboard 199',exact:true})).toBeFocused();
 await page.keyboard.press('Home');
 await expect(page.getByRole('row',{name:'Open Keyboard 000',exact:true})).toBeFocused();
 await page.keyboard.press('PageDown');
 await expect(page.getByRole('row',{name:'Open Keyboard 000',exact:true})).not.toBeFocused();
 await page.keyboard.press('Home');
 await expect(page.getByRole('row',{name:'Open Keyboard 000',exact:true})).toBeFocused();
 expect(await rows(page).count()).toBeLessThan(80);
});

test('table shortcuts sort export and compare, with discoverable keyboard help',async({page})=>{
 await setup(page);
 await expect(page.getByRole('navigation',{name:'Keyboard shortcuts',exact:true})).toBeVisible();
 await page.locator('body').click({position:{x:800,y:50}});
 await page.keyboard.press('Alt+1');
 const nameHeader=page.locator('.results thead th').first();
 await expect(nameHeader).toHaveAttribute('aria-sort','ascending');
 await page.keyboard.press('Alt+0');
 await expect(nameHeader).toHaveAttribute('aria-sort','descending');
 await page.keyboard.press('Alt+1');
 await expect(nameHeader).toHaveAttribute('aria-sort','ascending');
 await page.keyboard.press('Alt+e');
 await expect(page.getByRole('button',{name:'Save CSV',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save CSV',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__exports.length)).toBe(1);
 await page.keyboard.press('Alt+c');
 await expect(page.getByLabel('Compare',{exact:true})).toBeChecked();
 await rows(page).nth(0).click();
 await rows(page).nth(1).click();
 await page.keyboard.press('Alt+Enter');
 await expect(page.locator('.comparison')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.keyboard.press('?');
 await expect(page.getByRole('dialog')).toContainText('Keyboard shortcuts');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('saved searches capture unapplied filters and keep player and staff entries independent',async({page})=>{
 await setup(page);
 await page.getByLabel('Search players',{exact:true}).fill('Alex');
 await page.keyboard.press('Control+s');
 const panel=saved(page);
 await expect(panel.getByLabel('Search name',{exact:true})).toBeFocused();
 await panel.getByLabel('Search name',{exact:true}).fill('Favorites');
 await panel.getByRole('button',{name:'Save search',exact:true}).click();
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 await expect(rows(page)).toHaveCount(6);
 await panel.getByLabel('Saved searches',{exact:true}).selectOption({label:'Favorites'});
 await panel.getByRole('button',{name:'Load search',exact:true}).click();
 await expect(page.getByLabel('Search players',{exact:true})).toHaveValue('Alex');
 await expect(rows(page)).toHaveCount(1);
 await expect(rows(page).first()).toHaveAttribute('aria-label','Open Alex [Young]');
 await page.getByRole('button',{name:'Staff',exact:true}).click();
 await page.getByLabel('Search staff',{exact:true}).fill('Example');
 await openSaved(page);
 await panel.getByLabel('Search name',{exact:true}).fill('Favorites');
 await panel.getByRole('button',{name:'Save search',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:'Load FM24 save',exact:true}).click();
 await openSaved(page);
 await panel.getByLabel('Saved searches',{exact:true}).selectOption({label:'Favorites'});
 await panel.getByRole('button',{name:'Load search',exact:true}).click();
 await expect(rows(page).first()).toHaveAttribute('aria-label','Open Alex [Young]');
 await page.getByRole('button',{name:'Staff',exact:true}).click();
 await openSaved(page);
 await panel.getByLabel('Saved searches',{exact:true}).selectOption({label:'Favorites'});
 await panel.getByRole('button',{name:'Load search',exact:true}).click();
 await expect(rows(page).first()).toHaveAttribute('aria-label','Open Example Coach');
});

test('saved searches restore table layout and sort, and support update rename delete and validation',async({page})=>{
 await setup(page);
 await page.getByLabel('Table view',{exact:true}).selectOption('Technical');
 await page.locator('.results thead th').first().getByRole('button').click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByLabel('Currency',{exact:true}).selectOption('USD');
 await page.getByLabel('USD per €1',{exact:true}).fill('1.4');
 await page.getByLabel('USD per €1',{exact:true}).blur();
 await page.keyboard.press('Escape');
 const panel=await openSaved(page);
 await panel.getByLabel('Search name',{exact:true}).fill('Technical shortlist');
 await panel.getByRole('button',{name:'Save search',exact:true}).click();
 await page.getByLabel('Search players',{exact:true}).fill('Jo');
 await panel.getByRole('button',{name:'Update search',exact:true}).click();
 await panel.getByLabel('Search name',{exact:true}).fill('Midfield');
 await panel.getByRole('button',{name:'Rename search',exact:true}).click();
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 await page.getByLabel('Table view',{exact:true}).selectOption('Overview');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByLabel('Currency',{exact:true}).selectOption('EUR');
 await page.getByLabel('USD per €1',{exact:true}).fill('1.1127');
 await page.getByLabel('USD per €1',{exact:true}).blur();
 await page.keyboard.press('Escape');
 await panel.getByLabel('Saved searches',{exact:true}).selectOption({label:'Midfield'});
 await panel.getByRole('button',{name:'Load search',exact:true}).click();
 await expect(page.getByLabel('Search players',{exact:true})).toHaveValue('Jo');
 await expect(page.getByLabel('Table view',{exact:true})).toHaveValue('Technical');
 await expect(page.locator('.results thead th').first()).toHaveAttribute('aria-sort','ascending');
 await expect(rows(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByLabel('Currency',{exact:true})).toHaveValue('USD');
 await expect(page.getByLabel('USD per €1',{exact:true})).toHaveValue('1.4');
 await page.keyboard.press('Escape');
 await page.getByText('Column filters',{exact:true}).click();
 await page.getByRole('button',{name:'+ Add condition',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Update search',exact:true})).toBeDisabled();
 await panel.getByLabel('Search name',{exact:true}).fill('Invalid');
 await expect(panel.getByRole('button',{name:'Save search',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Delete search',exact:true}).click();
 await expect(panel.getByLabel('Saved searches',{exact:true}).getByRole('option',{name:'Midfield',exact:true})).toHaveCount(0);
});
