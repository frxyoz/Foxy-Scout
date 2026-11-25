import {test,expect,Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync('tests/fixtures/ui.json','utf8'));
async function setup(page:Page){
 await page.route('**/__scout_fixture',route=>route.fulfill({json:fixture}));
 await page.addInitScript(()=>{
  (window as any).__exports=[];
  (window as any).__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{
   if(command==='recent_saves'||command==='list_saves')return ['/fixtures/example.fm'];
   if(command==='load_save')return fetch('/__scout_fixture').then(r=>r.json());
   if(command==='load_preferences')return null;
   if(command==='role_report')return {current:[],potential:[]};
   if(command==='export_csv'){(window as any).__exports.push(args);return '/fixtures/export.csv';}
   throw new Error('Unexpected command '+command);
  }};
 });
 await page.goto('/');await load(page);
}
async function load(page:Page){await page.getByRole('button',{name:'Load FM24 save',exact:true}).click();await expect(page.getByRole('heading',{name:'Player scouting',exact:true})).toBeVisible();await expect(page.locator('aside button').filter({hasText:/^Load FM24 save$/})).toBeEnabled();}
async function panel(page:Page){const panel=page.locator('.notebook-panel');if(await panel.getAttribute('open')===null)await panel.locator('summary').first().click();return panel;}
async function manage(page:Page){const settings=page.locator('.notebook-settings');if(await settings.getAttribute('open')===null)await settings.locator('summary').click();}
async function createBook(page:Page,name='My career'){await panel(page);await manage(page);await page.getByLabel('New notebook name',{exact:true}).fill(name);await page.getByRole('button',{name:'Create notebook',exact:true}).click();}
const rows=(page:Page)=>page.locator('.results tbody tr[aria-label]');

test('shortlists, notes and tags persist, filter and export without changing save data',async({page},testInfo)=>{
 await setup(page);await createBook(page);
 await page.getByLabel('Shortlist name',{exact:true}).fill('Summer targets');
 await page.getByRole('button',{name:'Create shortlist',exact:true}).click();
 await expect(rows(page)).toHaveCount(0);
 await page.getByRole('button',{name:'Remove filter: Shortlist: Summer targets',exact:true}).click();
 await page.getByRole('row',{name:'Open Alex [Young]',exact:true}).click();
 await page.getByRole('button',{name:'Add player',exact:true}).click();
 await page.getByLabel('Player notes',{exact:true}).fill('Watch again before offering a contract.');
 await page.getByLabel('Tags (comma-separated)',{exact:true}).fill('Priority, Loan option, priority');
 await page.getByRole('button',{name:'Save notes',exact:true}).click();
 await expect(page.getByLabel('Tags (comma-separated)',{exact:true})).toHaveValue('Priority, Loan option');
 await page.screenshot({path:testInfo.outputPath('player-notes.png')});
 await page.getByRole('button',{name:'Back to Player List',exact:false}).click();
 await panel(page);await page.getByLabel('Shortlist view',{exact:true}).selectOption({label:'Summer targets (1)'});
 await page.screenshot({path:testInfo.outputPath('shortlist.png')});
 await expect(rows(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Export CSV',exact:true}).click();await page.getByRole('button',{name:'Save CSV',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__exports[0].contents)).toContain('Alex [Young]');
 expect(await page.evaluate(()=>(window as any).__exports[0].contents)).not.toContain('Sam Keeper');
 await page.reload();await load(page);await panel(page);
 await page.getByLabel('Player tag',{exact:true}).selectOption('Priority');await expect(rows(page)).toHaveCount(1);
 await rows(page).first().click();await expect(page.getByLabel('Player notes',{exact:true})).toHaveValue('Watch again before offering a contract.');
 await expect(page.getByRole('button',{name:'Remove Alex [Young] from Summer targets',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Remove Alex [Young] from Summer targets',exact:true}).click();
 await page.getByRole('button',{name:'Back to Player List',exact:false}).click();await panel(page);
 await expect(page.getByLabel('Shortlist view',{exact:true}).getByRole('option',{name:'Summer targets (0)',exact:true})).toHaveCount(1);
});

test('notebooks isolate careers and can link another save to the original career',async({page})=>{
 await setup(page);await createBook(page,'Career A');
 await page.getByRole('row',{name:'Open Alex [Young]',exact:true}).click();
 await page.getByLabel('Player notes',{exact:true}).fill('Only career A');await page.getByRole('button',{name:'Save notes',exact:true}).click();
 await page.getByRole('button',{name:'Back to Player List',exact:false}).click();
 const saves=page.locator('aside > details').first();if(await saves.getAttribute('open')===null)await saves.locator('summary').first().click();
 await page.getByLabel('Full path to .fm file',{exact:true}).fill('/fixtures/other.fm');await load(page);await panel(page);
 await expect(page.getByLabel('Scouting notebook',{exact:true})).toHaveValue('');
 await createBook(page,'Career B');
 await page.getByRole('row',{name:'Open Alex [Young]',exact:true}).click();await expect(page.getByLabel('Player notes',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Back to Player List',exact:false}).click();await panel(page);
 await manage(page);await page.getByLabel('Scouting notebook',{exact:true}).selectOption({label:'Career A'});
 await page.getByRole('row',{name:'Open Alex [Young]',exact:true}).click();await expect(page.getByLabel('Player notes',{exact:true})).toHaveValue('Only career A');
});

test('applied filter chips remove conditions immediately and preserve workspace drafts',async({page})=>{
 await setup(page);
 await page.getByLabel('Search players',{exact:true}).fill('Alex');await page.getByLabel('Search players',{exact:true}).press('Enter');
 await expect(rows(page)).toHaveCount(1);
 await page.getByLabel('Search players',{exact:true}).fill('Unapplied');
 await page.getByRole('button',{name:'Staff',exact:true}).click();await page.getByLabel('Search staff',{exact:true}).fill('Coach');await page.getByLabel('Search staff',{exact:true}).press('Enter');
 await page.getByRole('button',{name:'Remove filter: Search: Coach',exact:true}).click();await expect(page.getByLabel('Search staff',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Players',exact:true}).click();await expect(page.getByLabel('Search players',{exact:true})).toHaveValue('Unapplied');
 await page.getByRole('button',{name:'Remove filter: Search: Alex',exact:true}).click();await expect(rows(page)).toHaveCount(6);
 await expect(page.getByRole('navigation',{name:'Active filters',exact:true})).toHaveCount(0);
});

test('staff comparison keeps selections separate and supports category and keyboard navigation',async({page},testInfo)=>{
 const data=structuredClone(fixture);data.staff=[...data.staff,{...data.staff[0],UID:9002,uid:9002,Name:'Second Coach',name:'Second Coach',CA:130,ca:130,attributes:{...data.staff[0].attributes,Attacking:18}}];
 // setup installs a fixture route, so override it after setup and reload the save.
 await setup(page);await page.unroute('**/__scout_fixture');await page.route('**/__scout_fixture',route=>route.fulfill({json:data}));
 const save=page.locator('aside > details').first();await save.locator('summary').first().click();await load(page);
 await page.getByLabel('Compare',{exact:true}).check();await rows(page).nth(0).click();await rows(page).nth(1).click();
 await page.getByRole('button',{name:'Staff',exact:true}).click();await expect(page.getByLabel('Compare',{exact:true})).not.toBeChecked();
 await page.getByLabel('Compare',{exact:true}).check();await rows(page).nth(0).click();await rows(page).nth(1).click();
 await page.getByRole('button',{name:'Compare selected',exact:true}).click();await expect(page.getByRole('heading',{name:'Compare staff',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Coaching',exact:true}).click();await expect(page.locator('.comparison')).toContainText('Attacking');await expect(page.locator('.comparison thead')).toContainText('Second Coach');
 await page.screenshot({path:testInfo.outputPath('staff-comparison.png')});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Players',exact:true}).click();await expect(page.getByLabel('Compare',{exact:true})).toBeChecked();
 await expect(page.locator('.compare-controls')).toContainText('2 of 6 players selected');
 await page.getByRole('button',{name:'Staff',exact:true}).click();await page.locator('body').click({position:{x:800,y:50}});await page.keyboard.press('Alt+Enter');await expect(page.getByRole('heading',{name:'Compare staff',exact:true})).toBeVisible();
});

test('invalid or unavailable notebook storage is surfaced without replacing it',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('foxy-notebooks-v1','broken data'));
 await setup(page);await panel(page);await expect(page.locator('.notebook-panel').getByRole('alert')).toContainText('Existing data has been preserved');
 await page.getByLabel('New notebook name',{exact:true}).fill('Do not overwrite');await expect(page.getByRole('button',{name:'Create notebook',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>localStorage.getItem('foxy-notebooks-v1'))).toBe('broken data');
});

test('shortlist management retains missing players, supports rename and keeps notes after deletion',async({page})=>{
 await setup(page);await createBook(page);
 await page.getByLabel('Search players',{exact:true}).fill('Alex');await page.getByLabel('Search players',{exact:true}).press('Enter');
 await page.getByLabel('Shortlist name',{exact:true}).fill('Targets');await page.getByRole('button',{name:'Create shortlist',exact:true}).click();
 await page.getByRole('button',{name:/^Add matching players to shortlist/}).click();await expect(rows(page)).toHaveCount(1);
 await page.getByLabel('Shortlist name',{exact:true}).fill('Summer');await page.getByRole('button',{name:'Rename shortlist',exact:true}).click();
 await expect(page.getByRole('button',{name:'Remove filter: Shortlist: Summer',exact:true})).toBeVisible();
 await rows(page).first().click();await page.getByLabel('Player notes',{exact:true}).fill('Keep this after deletion');await page.getByRole('button',{name:'Save notes',exact:true}).click();await page.getByRole('button',{name:'Back to Player List',exact:false}).click();
 const absent=structuredClone(fixture);absent.players=absent.players.filter((row:any)=>row.UID!==100);
 await page.unroute('**/__scout_fixture');await page.route('**/__scout_fixture',route=>route.fulfill({json:absent}));
 const save=page.locator('aside > details').first();await save.locator('summary').first().click();await load(page);await panel(page);
 await page.getByLabel('Shortlist view',{exact:true}).selectOption({label:'Summer (1)'});
 await expect(page.locator('.notebook-members')).toContainText('1 not present in this save');await expect(rows(page)).toHaveCount(0);
 await page.unroute('**/__scout_fixture');await page.route('**/__scout_fixture',route=>route.fulfill({json:fixture}));
 if(await save.getAttribute('open')===null)await save.locator('summary').first().click();await load(page);await panel(page);
 await page.getByLabel('Shortlist view',{exact:true}).selectOption({label:'Summer (1)'});await expect(rows(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Delete shortlist',exact:true}).click();await expect(page.getByLabel('Shortlist view',{exact:true}).getByRole('option',{name:'Summer (1)',exact:true})).toHaveCount(0);
 await rows(page).first().click();await expect(page.getByLabel('Player notes',{exact:true})).toHaveValue('Keep this after deletion');
});

test('notebook storage failure leaves previous records intact and permits retry',async({page})=>{
 await setup(page);await createBook(page,'Original');
 const before=await page.evaluate(()=>localStorage.getItem('foxy-notebooks-v1'));
 await page.evaluate(()=>{
  const original=Storage.prototype.setItem;
  (window as any).__restoreStorage=()=>{Storage.prototype.setItem=original;};
  Storage.prototype.setItem=function(key,value){if(key==='foxy-notebooks-v1')throw new DOMException('Storage is full.','QuotaExceededError');return original.call(this,key,value);};
 });
 await manage(page);await page.getByLabel('New notebook name',{exact:true}).fill('Retry');await page.getByRole('button',{name:'Create notebook',exact:true}).click();
 await expect(page.locator('.notebook-panel').getByRole('alert')).toContainText('Storage is full');
 expect(await page.evaluate(()=>localStorage.getItem('foxy-notebooks-v1'))).toBe(before);
 await page.evaluate(()=>(window as any).__restoreStorage());await page.getByRole('button',{name:'Create notebook',exact:true}).click();
 await manage(page);await expect(page.getByLabel('Scouting notebook',{exact:true}).locator('option:checked')).toHaveText('Retry');
});

test('player comparison retains scenario-adjusted prices alongside staff comparison',async({page})=>{
 await setup(page);
 const data=structuredClone(fixture);data.players[0].SaleValueForeign=200000;
 await page.unroute('**/__scout_fixture');await page.route('**/__scout_fixture',route=>route.fulfill({json:data}));
 const save=page.locator('aside > details').first();await save.locator('summary').first().click();await load(page);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Currency',{exact:true}).selectOption('USD');await page.keyboard.press('Escape');
 await page.getByLabel('Buying-club eligibility',{exact:true}).selectOption('Foreign clubs');await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await page.getByLabel('Compare',{exact:true}).check();await page.getByRole('row',{name:'Open Alex [Young]',exact:true}).click();await page.getByRole('row',{name:'Open Sam Keeper',exact:true}).click();await page.getByRole('button',{name:'Compare selected',exact:true}).click();
 const sale=page.locator('.comparison tr').filter({has:page.getByRole('rowheader',{name:'Sale Value',exact:true})});
 await expect(sale.locator('.money-cell').first()).toHaveAttribute('aria-label','$200,000');
});
