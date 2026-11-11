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

test('player workflows preserve filters, reports, currency, export and comparison',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await setup(page);
 await expect(page.locator('.results-controls')).toContainText('6 players');
 await expect(page.locator('.results thead')).toContainText('PA − CA');
 await page.getByLabel('Player or UID',{exact:true}).fill('[');
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
 await page.getByLabel('Night theme',{exact:true}).check();
 await page.getByRole('button',{name:'Export CSV',exact:true}).click();
 await page.getByRole('button',{name:'Save CSV',exact:true}).click();
 const exports=await page.evaluate(()=>(window as any).__exports);
 expect(exports).toHaveLength(1);expect(exports[0].contents).toContain('100000');
 expect(exports[0].contents).toContain('Alex [Young]');
 await page.screenshot({path:'assets/screenshot-players.png',fullPage:true});
 await page.reload();
 await page.getByText('Settings',{exact:true}).click();
 await expect(page.getByLabel('Currency',{exact:true})).toHaveValue('USD');
 await expect(page.getByLabel('Night theme',{exact:true})).toBeChecked();
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
 await page.getByLabel('Staff name or UID',{exact:true}).fill('absent');
 await page.getByRole('button',{name:'Apply staff filters',exact:true}).click();
 await expect(page.getByText('No matches. Clear a filter to show more results.')).toBeVisible();
 await page.screenshot({path:'assets/screenshot-staff.png',fullPage:true});
});

test('large real-save result sets render through the desktop IPC contract',async({page})=>{
 test.skip(!process.env.FSS_UI_BASELINE,'Set FSS_UI_BASELINE to a local captured baseline');
 const baseline=JSON.parse(readFileSync(process.env.FSS_UI_BASELINE!,'utf8'));
 const data={players:baseline.table,staff:baseline.staff,game_date:baseline.game_date,game_year:baseline.game_year,fm_version:24,elapsed_ms:1000,cache_hit:false};
 await setup(page,data);
 const shown=baseline.table.filter((r:any)=>r.Age>=15&&r.Age<=40&&r.CA>=1&&r.PA>=1&&r.PA<=200);
 await expect(page.locator('.results-controls')).toContainText(shown.length.toLocaleString('en-US')+' players');
 expect(await page.locator('.results tbody tr').count()).toBeLessThan(60);
 await page.getByLabel('Player or UID',{exact:true}).fill('2002066982');
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
 const cell=page.locator('.money-cell[aria-label="$123,456,789"]');
 await cell.scrollIntoViewIfNeeded();
 await expect(cell).toHaveText('$123,456,789');
 const handle=page.locator('th').filter({has:page.getByRole('button',{name:'Market Value',exact:true})}).locator('.resize');
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
