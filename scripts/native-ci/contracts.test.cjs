'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { strictVersion, selectMatrix, runStages, verifyInstalled } = require('./lib.cjs');
const policy = require('./matrix.json');
test('only exact stable matrix selections can enter mandatory lanes', () => {
  assert.deepEqual(selectMatrix(policy, 'stable'), ['0.87.1', '0.86.3']);
  assert.deepEqual(selectMatrix(policy, 'anchor'), ['0.85.3']);
  for (const bad of ['latest','0.87','0.88.0-rc.6','0.88.0','0.87.1;echo x']) assert.throws(() => strictVersion(bad, policy));
});
for (const stage of ['npm','codegen','build']) test(`non-zero ${stage} fails closed before later stages`, async () => {
  const visited = [];
  await assert.rejects(runStages(['npm','codegen','build','attest'].map(name => ({ name, run: async () => { visited.push(name); return name === stage ? 37 : 0; } }))), new RegExp(stage));
  assert.deepEqual(visited, ['npm','codegen','build','attest'].slice(0, ['npm','codegen','build','attest'].indexOf(stage) + 1));
});
test('real process exit is preserved by stage runner', async () => {
  const { command } = require('./lib.cjs');
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'native-ci-contract-'));
  try { const r = command(process.execPath, ['-e','process.exit(23)'], { cwd:tmp, log:path.join(tmp,'exit.log') }); assert.equal(r.status,23); } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});
test('workflow required gates do not tolerate failure or restore native build caches', () => {
  const yaml = fs.readFileSync(path.join(__dirname,'../../.github/workflows/native-compat.yml'),'utf8');
  assert.match(yaml,/macos-26/); assert.match(yaml,/ubuntu-24.04/); assert.match(yaml,/cancel-in-progress: true/);
  assert.doesNotMatch(yaml,/continue-on-error|actions\/cache|pull_request_target|legacy-peer-deps|--force/);
  assert.match(yaml,/if:.*always\(\)/); assert.match(yaml,/native-ci\/contracts.test.cjs/);
  assert.match(yaml,/require\('\.\/scripts\/native-ci\/matrix.json'\)/);
});

test('lane rejects a dynamic RN selection before creating a consumer or executing npm', () => {
  const cp=require('node:child_process'), os=require('node:os');
  const dir=path.join(os.tmpdir(),'native-invalid-'+process.pid+'-'+Date.now());
  const r=cp.spawnSync(process.execPath,[path.join(__dirname,'lane.cjs'),'android','latest',dir],{encoding:'utf8'});
  assert.equal(r.status,1); assert.match(r.stderr,/exact stable RN/); assert.equal(fs.existsSync(dir),false);
});

test('provenance rejects mutated source, foreign integrity and symlink installs', () => {
  const os=require('node:os'),crypto=require('node:crypto');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'native-provenance-'));
  try {
    const ref=path.join(tmp,'reference'),consumer=path.join(tmp,'consumer'),installed=path.join(consumer,'node_modules/pkg'),tarball=path.join(tmp,'candidate.tgz');
    fs.mkdirSync(ref,{recursive:true});fs.mkdirSync(installed,{recursive:true});
    fs.writeFileSync(path.join(ref,'package.json'),JSON.stringify({name:'pkg'}));fs.writeFileSync(path.join(ref,'native.mm'),'candidate bytes');
    fs.cpSync(ref,installed,{recursive:true});fs.writeFileSync(tarball,'real archive integrity marker');
    const lock={packages:{'node_modules/pkg':{resolved:'file:'+tarball,integrity:'sha512-'+crypto.createHash('sha512').update(fs.readFileSync(tarball)).digest('base64')}}};
    const save=()=>fs.writeFileSync(path.join(consumer,'package-lock.json'),JSON.stringify(lock));save();
    assert.equal(verifyInstalled(ref,installed,tarball,consumer).files.length,2);
    fs.writeFileSync(path.join(installed,'native.mm'),'foreign bytes');assert.throws(()=>verifyInstalled(ref,installed,tarball,consumer),/tarball bytes differ/);
    fs.cpSync(ref,installed,{recursive:true});lock.packages['node_modules/pkg'].integrity='wrong';save();assert.throws(()=>verifyInstalled(ref,installed,tarball,consumer),/integrity/);
    fs.rmSync(installed,{recursive:true});fs.symlinkSync(ref,installed);assert.throws(()=>verifyInstalled(ref,installed,tarball,consumer),/physical/);
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});

test('iOS Codegen supports the real legacy and RN 0.87 ReactCodegen output roots and rejects missing output', () => {
  const {findIOSCodegen}=require('./lib.cjs');
  const tmp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'native-codegen-'));
  try {
    assert.throws(()=>findIOSCodegen(tmp),/missing/);
    for(const prefix of ['','ReactCodegen/']) {
      const file=path.join(tmp,prefix,'ReactNativeKCKeepAwakeSpec/ReactNativeKCKeepAwakeSpec.h');
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'generated header');
      assert.equal(findIOSCodegen(tmp),file);fs.rmSync(path.join(tmp,prefix,'ReactNativeKCKeepAwakeSpec'),{recursive:true});
    }
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});

test('lane records native provenance without a release workflow', () => {
  const cp=require('node:child_process'), os=require('node:os');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'native-standalone-'));
  const work=path.join(tmp,'lane');
  try {
    const r=cp.spawnSync(process.execPath,[path.join(__dirname,'lane.cjs'),'android',policy.stable[0],work],{
      encoding:'utf8',env:{...process.env,npm_config_force:'true'}
    });
    assert.equal(r.status,1);
    assert.ok(fs.existsSync(path.join(work,'result.json')),r.stderr);
    const result=JSON.parse(fs.readFileSync(path.join(work,'result.json'),'utf8'));
    assert.equal(result.status,'fail');
    assert.match(result.error,/forbidden inherited npm force/);
    assert.equal(result.commands.length,0);
    assert.ok(result.harness.some(({file})=>file==='.github/workflows/native-compat.yml'));
    assert.ok(result.harness.every(({file})=>!file.includes('monitor')&&!file.includes('react-native-releases')));
    for(const {file} of result.harness) assert.ok(fs.existsSync(path.join(__dirname,'../..',file)));
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});
