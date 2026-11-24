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

test('invalid column conditions describe the error and announce recovery',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'+ Add condition',exact:true}).click();
 const value=page.getByLabel('Condition 1 value',{exact:true});
 await expect(value).toHaveAttribute('aria-invalid','true');
 await expect(value).toHaveAccessibleDescription('Enter a value or remove this filter.');
 await expect(page.locator('.column-rule').getByRole('alert')).toHaveText('Enter a value or remove this filter.');
 await value.fill('150');
 await expect(value).toHaveAttribute('aria-invalid','false');
 await expect(value).toHaveAccessibleDescription('');
 await expect(page.getByRole('button',{name:'Apply filters',exact:true})).toBeEnabled();
});

test('saved-search keyboard validation exposes the error without stale success',async({page,browserName})=>{
 await setup(page);
 const name=page.getByLabel('Search name',{exact:true});
 const panel=page.locator('.saved-searches');
 await name.fill('Keyboard shortlist');
 await name.press('Enter');
 await expect(panel.getByRole('status')).toHaveText('Saved “Keyboard shortlist”.');
 await name.press('Enter');
 await expect(name).toHaveAttribute('aria-invalid','true');
 await expect(name).toHaveAccessibleDescription('That name is already saved. Choose another name or use Update search.');
 await expect(panel.locator('.saved-search-status')).toBeEmpty();
 await name.fill('Another shortlist');
 await expect(name).toHaveAttribute('aria-invalid','false');
 await expect(panel.getByRole('alert')).toHaveCount(0);
 // Safari follows macOS keyboard navigation preferences; Option+Tab includes buttons.
 await name.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
 await expect(panel.getByRole('button',{name:'Save search',exact:true})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(panel.getByRole('status')).toHaveText('Saved “Another shortlist”.');
});
