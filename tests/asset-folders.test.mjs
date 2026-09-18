import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readlinkSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {normalizeFolders, browseMapImages, showAssetFolders} from '../scripts/asset-folders.mjs';
import {connectionPlan} from '../scripts/folder-connection.mjs';

test('folder shortcuts reject unsafe paths and preserve separate sources/buckets', () => {
  const item = {source:'data',path:'familiar-assets/maps'};
  assert.equal(normalizeFolders([item,item,{source:'data',path:'/Users/name'}, {source:'data',path:'../private'}]).length,1);
  assert.equal(normalizeFolders([{source:'s3',path:'maps',bucket:'one'},{source:'s3',path:'maps',bucket:'two'}]).length,2);
});
test('non-GM cannot launch folder manager or file picker', async () => {
  globalThis.game = {user:{isGM:false}};
  await showAssetFolders(); await browseMapImages();
});
test('POSIX connector handles hostile file names literally and refuses to overwrite links', () => {
  const root = mkdtempSync(path.join(tmpdir(),'fvtt-connect-'));
  try {
    const source=path.join(root,"maps ' $(touch HACKED) `touch BAD`");
    const data=path.join(root,'Foundry Data'); mkdirSync(source);mkdirSync(data);
    const plan=connectionPlan({platform:'mac',source,data,name:'my-maps'});
    execFileSync('/bin/sh',['-c',plan.command],{cwd:root});
    const target=path.join(data,plan.relative);
    assert.equal(readlinkSync(target),source);
    assert.equal(existsSync(path.join(root,'HACKED')),false);
    assert.equal(existsSync(path.join(root,'BAD')),false);
    assert.match(execFileSync('/bin/sh',['-c',plan.command],{encoding:'utf8'}),/already exists/);
    assert.equal(readlinkSync(target),source);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('connector validates paths and Windows quotes', () => {
  assert.throws(()=>connectionPlan({platform:'mac',source:'maps',data:'/data',name:'maps'}));
  assert.throws(()=>connectionPlan({platform:'linux',source:'/maps',data:'/data',name:'../private'}));
  const plan=connectionPlan({platform:'windows',source:"D:\\Dustin's Maps",data:'C:\\Foundry\\Data',name:'maps'});
  assert.match(plan.command,/Dustin''s Maps/);
  assert.match(plan.command,/-ItemType Junction/);
});
