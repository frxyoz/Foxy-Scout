import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'tests', testMatch:['desktop.spec.ts','preferences.spec.ts','shortcuts-searches.spec.ts'], timeout:45000, workers:1,
 use:{baseURL:'http://127.0.0.1:1420',viewport:{width:1440,height:1000}},
 webServer:{command:'npm run dev',url:'http://127.0.0.1:1420',reuseExistingServer:true,timeout:30000},
 reporter:[['list']]
});
