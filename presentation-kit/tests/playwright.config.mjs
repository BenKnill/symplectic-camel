import path from 'node:path';
import { defineConfig } from '@playwright/test';
import { launchOptions, output } from './common.mjs';

export default defineConfig({
  testDir:'.',testMatch:'offline.spec.mjs',fullyParallel:false,workers:1,retries:0,
  timeout:300000,expect:{timeout:15000},
  reporter:[['line'],['json',{outputFile:path.join(output,'evidence/playwright-results.json')}]],
  outputDir:path.join(output,'evidence/playwright-artifacts'),
  use:{browserName:'chromium',launchOptions,headless:true,hasTouch:true,reducedMotion:'reduce',screenshot:'only-on-failure',trace:'retain-on-failure'},
  projects:[
    {name:'desktop-1440',use:{viewport:{width:1440,height:1000}}},
    {name:'tablet-1024',use:{viewport:{width:1024,height:768}}},
    {name:'phone-emulation-390',use:{viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1}},
  ],
});
