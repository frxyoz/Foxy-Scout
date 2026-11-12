import {test,expect,Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

const fixture=JSON.parse(readFileSync('tests/fixtures/ui.json','utf8'));
async function setup(page:Page,data=fixture,legacyNight?:boolean){
 await page.route('**/__scout_fixture',route=>route.fulfill({json:data}));
 await page.addInitScript(({legacyNight})=>{
  if(legacyNight!==undefined&&!localStorage.getItem('preferences-test-seeded')){
   localStorage.setItem('foxy-night',JSON.stringify(legacyNight));
   localStorage.setItem('preferences-test-seeded','true');
  }
  (window as any).__TAURI_INTERNALS__={invoke:async(command:string)=>{
   if(command==='recent_saves'||command==='list_saves')return ['/fixtures/example.fm'];
   if(command==='choose_save')return '/fixtures/example.fm';
   if(command==='load_save')return fetch('/__scout_fixture').then(r=>r.json());
   if(command==='load_preferences')return null;
   if(command==='role_report')return {current:[],potential:[]};
   if(command==='quit_app')return;
   throw new Error('Unexpected command '+command);
  }};
 },{legacyNight});
 await page.goto('/');
 await page.getByRole('button',{name:'Load FM24 save',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Player scouting',exact:true})).toBeVisible();
}
const settings=(page:Page)=>page.getByRole('region',{name:'Settings',exact:true});
async function openSettings(page:Page){
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Preferences',exact:true})).toBeVisible();
}

test('appearance follows the system, color choices persist and settings preserve focus',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});
 await setup(page);
 await openSettings(page);
 await expect(page.getByLabel('Appearance',{exact:true})).toHaveValue('system');
 await page.emulateMedia({colorScheme:'dark'});
 await expect(page.locator('html')).toHaveAttribute('data-theme','night');
 await page.emulateMedia({colorScheme:'light'});
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 for(const color of ['Rust','Blue','Green','Purple','Red','Slate']){
  const swatch=settings(page).getByRole('button',{name:color,exact:true});
  await swatch.click();
  await expect(swatch).toHaveAttribute('aria-pressed','true');
 }
 await page.getByLabel('Appearance',{exact:true}).selectOption('dark');
 await settings(page).getByRole('button',{name:'Blue',exact:true}).click();
 await page.getByRole('button',{name:'Close settings',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeFocused();
 await page.reload();
 await openSettings(page);
 await expect(page.getByLabel('Appearance',{exact:true})).toHaveValue('dark');
 await expect(settings(page).getByRole('button',{name:'Blue',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('html')).toHaveAttribute('data-accent','blue');
 await page.keyboard.press('Escape');
 await expect(settings(page)).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeFocused();
});

test('compact rows stay aligned while scrolling a virtual table and visual preferences persist',async({page})=>{
 const data=structuredClone(fixture);
 data.players=Array.from({length:200},(_,i)=>({...fixture.players[0],UID:1000+i,Name:`Player ${String(i).padStart(3,'0')}`}));
 await setup(page,data);
 await openSettings(page);
 await page.getByLabel('Table density',{exact:true}).selectOption('compact');
 await page.getByLabel('Show rating bars',{exact:true}).uncheck();
 await page.getByLabel('Motion',{exact:true}).selectOption('reduced');
 await page.keyboard.press('Escape');
 await expect(page.locator('html')).toHaveAttribute('data-density','compact');
 await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
 await expect(page.locator('.score-fill').first()).toBeHidden();
 await expect(page.locator('.results tbody tr[aria-label]').first().locator('td').first()).toHaveCSS('height','28px');
 expect(await page.locator('.results tbody tr[aria-label]').count()).toBeLessThan(70);
 await page.locator('.table-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 await expect(page.getByRole('row',{name:'Open Player 199',exact:true})).toBeVisible();
 await page.reload();
 await openSettings(page);
 await expect(page.getByLabel('Table density',{exact:true})).toHaveValue('compact');
 await expect(page.getByLabel('Show rating bars',{exact:true})).not.toBeChecked();
 await expect(page.getByLabel('Motion',{exact:true})).toHaveValue('reduced');
});

test('exchange-rate drafts allow blank input and reset restores all defaults',async({page})=>{
 await setup(page);
 await openSettings(page);
 const rate=page.getByLabel('USD per €1',{exact:true});
 await rate.fill('');
 await expect(rate).toHaveValue('');
 await rate.fill('1.25');
 await rate.blur();
 await expect(rate).toHaveValue('1.25');
 await rate.fill('0');
 await rate.blur();
 await expect(rate).toHaveValue('1.25');
 await page.getByLabel('Currency',{exact:true}).selectOption('USD');
 await page.getByLabel('Appearance',{exact:true}).selectOption('dark');
 await settings(page).getByRole('button',{name:'Purple',exact:true}).click();
 await page.getByLabel('Table density',{exact:true}).selectOption('compact');
 await page.getByLabel('Show rating bars',{exact:true}).uncheck();
 await page.getByLabel('Motion',{exact:true}).selectOption('reduced');
 await settings(page).getByRole('button',{name:'Reset preferences',exact:true}).click();
 await expect(page.getByLabel('Appearance',{exact:true})).toHaveValue('system');
 await expect(settings(page).getByRole('button',{name:'Rust',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Table density',{exact:true})).toHaveValue('comfortable');
 await expect(page.getByLabel('Show rating bars',{exact:true})).toBeChecked();
 await expect(page.getByLabel('Motion',{exact:true})).toHaveValue('system');
 await expect(page.getByLabel('Currency',{exact:true})).toHaveValue('EUR');
 await expect(rate).toHaveValue('1.1127');
 await page.reload();
 await openSettings(page);
 await expect(page.getByLabel('Appearance',{exact:true})).toHaveValue('system');
 await expect(page.getByLabel('Currency',{exact:true})).toHaveValue('EUR');
 await expect(page.getByLabel('USD per €1',{exact:true})).toHaveValue('1.1127');
});

for(const legacyNight of [true,false])test(`legacy night preference ${legacyNight} migrates to explicit appearance`,async({page})=>{
 await setup(page,fixture,legacyNight);
 await openSettings(page);
 await expect(page.getByLabel('Appearance',{exact:true})).toHaveValue(legacyNight?'dark':'light');
});
