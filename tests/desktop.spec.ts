import {test,expect,Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync('tests/fixtures/ui.json','utf8'));
async function setup(page:Page,data=fixture){
 await page.route('**/__scout_fixture',route=>route.fulfill({json:data}));
 await page.addInitScript(()=>{
  (window as any).__exports=[];
  (window as any).__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{
   if(command==='recent_saves')return ['/fixtures/example.fm'];
   if(command==='choose_save')return '/fixtures/example.fm';
   if(command==='list_saves')return ['/fixtures/example.fm'];
   if(command==='load_save')return fetch('/__scout_fixture').then(r=>r.json());
   if(command==='export_csv'){(window as any).__exports.push(args);return '/fixtures/export.csv';}
   if(command==='quit_app')return;
   if(command==='load_preferences')return null;
   if(command==='role_report')return {current:[],potential:[]};
   throw new Error('Unexpected command '+command);
  }};
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Load FM24 save',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Player scouting',exact:true})).toBeVisible();
}

test('compact multi-selects toggle immediately, filter, reset and respect reduced motion',async({page})=>{
 await setup(page);
 const positions=page.getByRole('group',{name:'Positions',exact:true}).filter({has:page.getByRole('button',{name:'GK',exact:true})});
 const gk=positions.getByRole('button',{name:'GK',exact:true});
 const dl=positions.getByRole('button',{name:'DL',exact:true});
 await gk.click();
 await dl.focus();
 await page.keyboard.press('Space');
 await expect(gk).toHaveAttribute('aria-pressed','true');
 await expect(dl).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect(page.locator('.results tbody tr[aria-label]')).toHaveCount(1);
 await expect(page.getByRole('row',{name:'Open Sam Keeper',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear positions',exact:true}).click();
 await expect(gk).toHaveAttribute('aria-pressed','false');
 await expect(dl).toHaveAttribute('aria-pressed','false');
 await expect(page.getByRole('button',{name:'Clear positions',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect(page.locator('.results tbody tr[aria-label]')).toHaveCount(6);
 await page.getByRole('button',{name:'Staff',exact:true}).click();
 const nationality=page.locator('.multi-disclosure');
 await nationality.locator('summary').click();
 const first=nationality.getByRole('checkbox').first();
 const name=await first.locator('..').innerText();
 await nationality.getByRole('searchbox').fill(name.trim());
 await first.check();
 await expect(nationality.locator('summary')).toHaveText('1 selected');
 await page.keyboard.press('Escape');
 await expect(nationality).not.toHaveAttribute('open');
 await page.getByRole('button',{name:'Clear nationality',exact:true}).click();
 await expect(nationality.locator('summary')).toHaveText('Any nationality');
 await page.emulateMedia({reducedMotion:'reduce'});
 await nationality.locator('summary').click();
 expect(await page.locator('.multi-content').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.screenshot({path:'test-results/minimal-filters-light.png',fullPage:true});
 await page.getByRole('button',{name:'Players',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByLabel('Appearance',{exact:true}).selectOption('dark');
 await page.keyboard.press('Escape');
 await gk.click();
 await dl.click();
 await page.screenshot({path:'test-results/minimal-filters-night.png',fullPage:true});
});

test('search shortcuts, pending feedback and searchable columns preserve workspace state',async({page})=>{
 await setup(page);
 await page.keyboard.press('Control+f');
 const search=page.getByLabel('Search players',{exact:true});
 await expect(search).toBeFocused();
 await search.fill('Alex');
 await expect(page.locator('.pending-label')).toHaveText('Unapplied changes');
 await expect(page.locator('.results-controls')).toContainText('6 players');
 await page.keyboard.press('Control+Enter');
 await expect(page.locator('.results-controls')).toContainText('1 players');
 await expect(page.locator('.pending-label')).toHaveCount(0);
 await page.getByRole('button',{name:'Staff',exact:true}).click();
 await expect(page.locator('.pending-label')).toHaveCount(0);
 await page.keyboard.press('Control+f');
 await expect(page.getByLabel('Search staff',{exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Players',exact:true}).click();
 await expect(search).toHaveValue('Alex');
 await page.getByText('Customize columns',{exact:true}).click();
 await page.getByRole('searchbox',{name:'Find a column',exact:true}).fill('Consis');
 const column=page.locator('.column-options input[type="checkbox"]').first();
 await expect(column).toHaveCount(1);
 await column.check();
 await expect(page.locator('.results thead')).toContainText('Consis');
 await page.keyboard.press('Escape');
 await expect(page.locator('.column-picker')).not.toHaveAttribute('open');
 await expect(page.locator('.column-picker summary')).toBeFocused();
 await page.getByText('Customize columns',{exact:true}).click();
 await expect(page.getByRole('searchbox',{name:'Find a column',exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Restore default',exact:true}).click();
 await expect(page.locator('.results thead')).not.toContainText('Consis');
});

test('player workflows preserve filters, reports, currency, export and comparison',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await setup(page);
 await expect(page.locator('.results-controls')).toContainText('6 players');
 await expect(page.locator('.results thead')).toContainText('PA − CA');
 await page.getByLabel('Search players',{exact:true}).fill('[');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect(page.locator('.results-controls')).toContainText('1 players');
 await page.getByRole('row',{name:'Open Alex [Young]',exact:true}).click();
 for(const name of ['Technical','Mental','Physical','Hidden & feet','Personality','Goalkeeping','Positions & roles','Role ratings','Contract & value','Player information']){
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
 }
 await expect(page.locator('.metrics')).toContainText('€89,871');
 await page.getByRole('button',{name:'Back to Player List'}).click();
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 await page.getByLabel('Compare',{exact:true}).check();
 await page.getByRole('row',{name:'Open Alex [Young]',exact:true}).click();
 await page.getByRole('row',{name:'Open Jo Midfielder',exact:true}).click();
 await page.getByRole('button',{name:'Compare selected',exact:true}).click();
 await expect(page.locator('.comparison')).toContainText('Alex [Young]');
 await expect(page.locator('.comparison')).toContainText('Jo Midfielder');
 await page.getByRole('button',{name:'Back to Player List'}).click();
 await page.getByText('Settings',{exact:true}).click();
 await page.getByLabel('Currency',{exact:true}).selectOption('USD');
 await page.getByLabel('Appearance',{exact:true}).selectOption('dark');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Export CSV',exact:true}).click();
 await page.getByRole('button',{name:'Save CSV',exact:true}).click();
 const exports=await page.evaluate(()=>(window as any).__exports);
 expect(exports).toHaveLength(1);expect(exports[0].contents).toContain('100000');
 expect(exports[0].contents).toContain('Alex [Young]');
 await page.screenshot({path:'test-results/screenshot-players.png',fullPage:true});
 await page.reload();
 await page.getByText('Settings',{exact:true}).click();
 await expect(page.getByLabel('Currency',{exact:true})).toHaveValue('USD');
 await expect(page.getByLabel('Appearance',{exact:true})).toHaveValue('dark');
 expect(errors).toEqual([]);
});

test('staff sheets and empty and error states',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'Staff',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Staff scouting',exact:true})).toBeVisible();
 await page.getByRole('row',{name:'Open Example Coach',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Example Coach',exact:true})).toBeVisible();
 for(const group of ['Scouting','Medical','Mental']){
  await page.getByRole('button',{name:group,exact:true}).click();
  await expect(page.locator('.staff-attributes')).toBeVisible();
 }
 await page.getByRole('button',{name:'Back to Staff List'}).click();
 await page.getByLabel('Search staff',{exact:true}).fill('absent');
 await page.getByRole('button',{name:'Apply staff filters',exact:true}).click();
 await expect(page.getByText('No matches. Clear a filter to show more results.')).toBeVisible();
 await page.screenshot({path:'test-results/screenshot-staff.png',fullPage:true});
});

test('large real-save result sets render through the desktop IPC contract',async({page})=>{
 test.skip(!process.env.FSS_UI_BASELINE,'Set FSS_UI_BASELINE to a local captured baseline');
 const baseline=JSON.parse(readFileSync(process.env.FSS_UI_BASELINE!,'utf8'));
 const data={players:baseline.table,staff:baseline.staff,game_date:baseline.game_date,game_year:baseline.game_year,fm_version:24,elapsed_ms:1000,cache_hit:false};
 await setup(page,data);
 const shown=baseline.table.filter((r:any)=>r.Age>=15&&r.Age<=40&&r.CA>=1&&r.PA>=1&&r.PA<=200);
 await expect(page.locator('.results-controls')).toContainText(shown.length.toLocaleString('en-US')+' players');
 expect(await page.locator('.results tbody tr').count()).toBeLessThan(60);
 await page.getByLabel('Search players',{exact:true}).fill('2002066982');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect(page.getByRole('row',{name:'Open Tejay McGrann',exact:true})).toBeVisible();
 await page.getByRole('row',{name:'Open Tejay McGrann',exact:true}).click();
 await expect(page.locator('.metrics')).toContainText('160 / 200');
 await page.screenshot({path:'.cache/migration/desktop-real-report.png',fullPage:true});
});

test('money cells abbreviate only at narrow widths and retain full accessible values',async({page})=>{
 const data=structuredClone(fixture);data.players[0].MarketValue=123456789;
 await setup(page,data);
 await page.getByText('Settings',{exact:true}).click();
 await page.getByLabel('Currency',{exact:true}).selectOption('USD');
 await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');
 const cell=page.locator('.money-cell[aria-label="$123,456,789"]');
 await cell.scrollIntoViewIfNeeded();
 await expect(cell).toHaveText('$123,456,789');
 const handle=page.locator('th').filter({has:page.getByRole('button',{name:'Market Value',exact:true})}).locator('.resize');
 await handle.scrollIntoViewIfNeeded();
 const box=(await handle.boundingBox())!;
 await page.mouse.move(box.x+3,box.y+12);await page.mouse.down();
 await page.mouse.move(box.x-90,box.y+12);await page.mouse.up();
 await expect(cell).toHaveText('$123.5M');
 await expect(cell).toHaveAttribute('title','$123,456,789');
});

test('load failures show an actionable error and release the load button',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{(window as any).__TAURI_INTERNALS__.invoke=async()=>{throw new Error('The save changed while loading. Finish saving in FM24 and load it again.');};});
 await page.locator('aside details').first().locator('summary').first().click();
 await page.getByRole('button',{name:'Load FM24 save',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Finish saving in FM24');
 await expect(page.getByRole('button',{name:'Load FM24 save',exact:true})).toBeEnabled();
});

test('CSV export supports sorted row ranges, table columns and validation',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'Player',exact:true}).click();
 const names=await page.locator('.results tbody tr[aria-label]').evaluateAll(rows=>rows.map(row=>row.getAttribute('aria-label')!.replace('Open ','')));
 await page.getByRole('button',{name:'Export CSV',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText('6 data rows');
 await dialog.getByLabel('Rows to export').selectOption('range');
 await dialog.getByLabel('Start at row').fill('2');
 await dialog.getByLabel('Number of rows').fill('0');
 await expect(dialog.getByRole('button',{name:'Save CSV',exact:true})).toBeDisabled();
 await dialog.getByLabel('Number of rows').fill('6');
 await expect(dialog.getByRole('button',{name:'Save CSV',exact:true})).toBeDisabled();
 await dialog.getByLabel('Number of rows').fill('2');
 await dialog.getByLabel('Columns to export').selectOption('visible');
 await dialog.getByLabel('Separator').selectOption(';');
 await dialog.getByLabel('Include column headers').uncheck();
 await expect(dialog).toContainText('2 data rows');
 await expect(dialog).toContainText('rows 2–3');
 await page.screenshot({path:'test-results/csv-export-dialog.png'});
 await dialog.getByRole('button',{name:'Save CSV',exact:true}).click();
 await expect(dialog).not.toBeVisible();
 const exports=await page.evaluate(()=>(window as any).__exports);
 expect(exports).toHaveLength(1);
 const lines=exports[0].contents.replace(/^\uFEFF/,'').split('\r\n');
 expect(lines).toHaveLength(2);
 expect(lines[0].startsWith('"'+names[1]+'";')).toBe(true);
 expect(lines[1].startsWith('"'+names[2]+'";')).toBe(true);
 expect(exports[0].contents).not.toContain('RoleReport');
 await page.getByRole('button',{name:'Export CSV',exact:true}).click();
 await page.keyboard.press('Escape');
 await expect(dialog).not.toBeVisible();
 expect(await page.evaluate(()=>(window as any).__exports.length)).toBe(1);
});

test('staff CSV export handles save cancellation, errors and retry',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'Staff',exact:true}).click();
 await page.getByRole('button',{name:'Export CSV',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText('Export staff to CSV');
 await page.evaluate(()=>{
  const original=(window as any).__TAURI_INTERNALS__.invoke;
  let attempts=0;
  (window as any).__TAURI_INTERNALS__.invoke=async(command:string,args:any)=>{
   if(command==='export_csv'){
    attempts++;
    if(attempts===1)return null;
    if(attempts===2)throw new Error('Disk is full');
   }
   return original(command,args);
  };
 });
 await dialog.getByRole('button',{name:'Save CSV',exact:true}).click();
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Save CSV',exact:true})).toBeEnabled();
 await dialog.getByRole('button',{name:'Save CSV',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('Disk is full');
 await dialog.getByRole('button',{name:'Save CSV',exact:true}).click();
 await expect(dialog).not.toBeVisible();
 const exports=await page.evaluate(()=>(window as any).__exports);
 expect(exports).toHaveLength(1);
 expect(exports[0].suggestedName).toBe('foxy-staff.csv');
 expect(exports[0].contents).toContain('Example Coach');
});

test('numeric filters allow clearing and replacing digits before restoring defaults',async({page})=>{
 await setup(page);
 const age=page.getByRole('spinbutton',{name:'Player age minimum',exact:true});
 await age.focus();
 await page.keyboard.press('End');
 await page.keyboard.press('Backspace');
 await expect(age).toHaveValue('1');
 await page.keyboard.press('Backspace');
 await expect(age).toHaveValue('');
 await age.fill('21');
 await age.blur();
 await expect(age).toHaveValue('21');
 await age.fill('');
 await age.blur();
 await expect(age).toHaveValue('15');
 for(const section of ['Ability','Market']) await page.locator('summary').getByText(section,{exact:true}).click();
 const playerInputs=page.locator('aside form input[type="number"]');
 const defaults=['15','40','1','200','1','200','0','100','0','100','0','0'];
 await expect(playerInputs).toHaveCount(defaults.length);
 for(let i=0;i<defaults.length;i++){
  const input=playerInputs.nth(i);
  await input.fill('');
  await expect(input).toHaveValue('');
  await input.blur();
  await expect(input).toHaveValue(defaults[i]);
 }
 await age.fill('2');
 await age.press('Enter');
 await expect(age).toHaveValue('15');
 await page.getByRole('button',{name:'Staff',exact:true}).click();
 const staffInputs=page.locator('aside form input[type="number"]');
 for(const [i,value] of ['18','80','1'].entries()){
  const input=staffInputs.nth(i);
  await input.fill('');
  await expect(input).toHaveValue('');
  await input.blur();
  await expect(input).toHaveValue(value);
 }
});

test('market minus sale column displays, sorts and exports the selected scenario',async({page})=>{
 const data=structuredClone(fixture);
 data.players[0].MarketValue=500000;
 data.players[0].SaleValue=100000;
 data.players[0].SaleValueForeign=200000;
 await setup(page,data);
 await page.getByText('Settings',{exact:true}).click();
 await page.getByLabel('Currency',{exact:true}).selectOption('USD');
 const heading=page.getByRole('button',{name:'Market − Sale',exact:true});
 await expect(heading).toBeVisible();
 const row=page.getByRole('row',{name:'Open Alex [Young]',exact:true});
 await expect(row.locator('.money-cell[aria-label="$400,000"]')).toBeVisible();
 await page.locator('summary').getByText('Market',{exact:true}).click();
 await page.getByLabel('Buying-club eligibility').selectOption('Foreign clubs');
 await page.getByLabel('Sort results by').selectOption('ValueDifference');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect(row.locator('.money-cell[aria-label="$300,000"]')).toBeVisible();
 await heading.click();
 await expect(page.getByRole('button',{name:'Market − Sale ↓',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Export CSV',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Columns to export').selectOption('visible');
 await page.getByRole('button',{name:'Save CSV',exact:true}).click();
 const exports=await page.evaluate(()=>(window as any).__exports);
 expect(exports[0].contents).toContain('"ValueDifference"');
 expect(exports[0].contents).toContain('"300000"');
});

test('player listing badges sit before names and listing filters support both statuses',async({page})=>{
 const data=structuredClone(fixture);
 Object.assign(data.players[0],{TransferListed:true,LoanListed:false});
 Object.assign(data.players[1],{TransferListed:false,LoanListed:true});
 Object.assign(data.players[2],{TransferListed:true,LoanListed:true});
 Object.assign(data.players[3],{TransferListed:false,LoanListed:false});
 Object.assign(data.players[4],{TransferListed:null,LoanListed:null});
 await setup(page,data);
 const row=(i:number)=>page.getByRole('row',{name:'Open '+data.players[i].Name,exact:true});
 await expect(row(0).getByLabel('Transfer listed',{exact:true})).toHaveText('Trn');
 await expect(row(0).getByLabel('Loan listed',{exact:true})).toHaveCount(0);
 await expect(row(1).getByLabel('Loan listed',{exact:true})).toHaveText('Loa');
 await expect(row(2).locator('.listing-badge')).toHaveCount(2);
 await expect(row(3).locator('.listing-badge')).toHaveCount(0);
 await expect(row(4).locator('.listing-badge')).toHaveCount(0);
 const badgeBox=(await row(0).locator('.listing-badge').boundingBox())!;
 const nameBox=(await row(0).locator('.player-name-text').boundingBox())!;
 expect(badgeBox.x+badgeBox.width).toBeLessThan(nameBox.x);
 await page.screenshot({path:'test-results/listing-badges.png',fullPage:true});
 await page.getByText('Settings',{exact:true}).click();
 await page.getByLabel('Appearance',{exact:true}).selectOption('dark');
 await expect(row(0).getByLabel('Transfer listed',{exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/listing-badges-night.png',fullPage:true});
 await page.locator('summary').getByText('Market',{exact:true}).click();
 const listing=page.getByLabel('Listing status',{exact:true});
 for(const [value,count] of [['Transfer',2],['Loan',2],['Either',3]] as const){
  await listing.selectOption(value);
  await page.getByRole('button',{name:'Apply filters',exact:true}).click();
  await expect(page.locator('.results-controls')).toContainText(count+' players');
 }
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 await expect(listing).toHaveValue('All');
 await expect(page.locator('.results-controls')).toContainText('6 players');
 await row(0).getByLabel('Transfer listed',{exact:true}).click();
 await expect(page.getByRole('heading',{name:data.players[0].Name,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to Player List'}).click();
 await page.getByRole('button',{name:'Staff',exact:true}).click();
 await expect(page.locator('.listing-badge')).toHaveCount(0);
});

test('column filters combine hidden attributes, currency, text and staff conditions',async({page})=>{
 const data=structuredClone(fixture);
 Object.assign(data.players[0],{Consis:19,MarketValue:1000000,TransferListed:true});
 Object.assign(data.players[1],{Consis:4,MarketValue:1000000});
 await setup(page,data);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByLabel('Currency',{exact:true}).selectOption('USD');
 await page.keyboard.press('Escape');
 await page.locator('summary').getByText('Column filters',{exact:true}).click();
 await page.getByRole('button',{name:'+ Add condition',exact:true}).click();
 await page.getByLabel('Condition 1 column',{exact:true}).selectOption('Consis');
 await page.getByLabel('Condition 1 value',{exact:true}).fill('19');
 await page.getByRole('button',{name:'+ Add condition',exact:true}).click();
 await page.getByLabel('Condition 2 column',{exact:true}).selectOption('MarketValue');
 await page.getByLabel('Condition 2 operator',{exact:true}).selectOption('lte');
 await page.getByLabel('Condition 2 value',{exact:true}).fill('1000000');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect(page.locator('.results-controls')).toContainText('1 players');
 await expect(page.getByRole('row',{name:'Open '+data.players[0].Name,exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/column-filters.png',fullPage:true});
 await page.getByLabel('Condition 1 value',{exact:true}).fill('');
 await expect(page.getByLabel('Condition 1 value',{exact:true})).toHaveValue('');
 await expect(page.getByRole('button',{name:'Apply filters',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 await page.getByLabel('Search players',{exact:true}).fill('North FC');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 const expected=data.players.filter((r:any)=>r.Club==='North FC').length;
 await expect(page.locator('.results-controls')).toContainText(expected+' players');
 await page.getByRole('button',{name:'Staff',exact:true}).click();
 await page.locator('summary').getByText('Column filters',{exact:true}).click();
 await page.getByRole('button',{name:'+ Add condition',exact:true}).click();
 await page.getByLabel('Condition 1 column',{exact:true}).selectOption('Physiotherapy');
 await page.getByLabel('Condition 1 value',{exact:true}).fill('21');
 await page.getByRole('button',{name:'Apply staff filters',exact:true}).click();
 await expect(page.getByText('No matches. Clear a filter to show more results.')).toBeVisible();
 await page.getByRole('button',{name:'Reset staff filters',exact:true}).click();
 await expect(page.getByLabel('Condition 1 column',{exact:true})).toHaveCount(0);
});

test('top-right settings, About and app actions work without losing the current search',async({page})=>{
 await setup(page);
 await page.getByLabel('Search players',{exact:true}).fill('Alex');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 const settings=page.getByRole('button',{name:'Settings',exact:true});
 const box=(await settings.boundingBox())!;
 expect(box.x).toBeGreaterThan(1000);
 await settings.click();
 await page.getByLabel('Appearance',{exact:true}).selectOption('dark');
 await page.screenshot({path:'test-results/top-right-settings.png',fullPage:true});
 await page.keyboard.press('Escape');
 await expect(settings).toBeFocused();
 await expect(page.getByRole('region',{name:'Settings',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'About Foxy Scout',exact:true}).click();
 await expect(page.getByRole('heading',{name:'About Foxy Scout',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Build a better search',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/about-redesigned.png',fullPage:true});
 await page.getByRole('button',{name:'Back to players'}).click();
 await expect(page.getByLabel('Search players',{exact:true})).toHaveValue('Alex');
 await expect(page.locator('.results-controls')).toContainText('1 players');
 await page.getByRole('button',{name:'More app actions',exact:true}).click();
 await expect(page.getByRole('button',{name:'Quit Foxy Scout',exact:true})).toBeVisible();
 await page.evaluate(()=>{
  const original=(window as any).__TAURI_INTERNALS__.invoke;
  (window as any).__quitCalled=false;
  (window as any).__TAURI_INTERNALS__.invoke=async(command:string,args:any)=>{
   if(command==='quit_app'){(window as any).__quitCalled=true;return;}
   return original(command,args);
  };
 });
 await page.getByRole('button',{name:'Quit Foxy Scout',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__quitCalled)).toBe(true);
});
