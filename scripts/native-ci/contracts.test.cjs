'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { strictVersion, selectMatrix, laneEntries, compareVersions, runStages, verifyInstalled } = require('./lib.cjs');
const policy = require('./matrix.json');
test('only exact matrix selections can enter mandatory lanes', () => {
  assert.deepEqual(selectMatrix(policy, 'stable'), ['0.88.0', '0.87.1']);
  assert.deepEqual(selectMatrix(policy, 'window'), ['0.82.1', '0.78.3', '0.76.9']);
  assert.deepEqual(selectMatrix(policy, 'support'), ['0.88.0', '0.87.1', '0.82.1', '0.78.3', '0.76.9']);
  assert.deepEqual(selectMatrix(policy, 'anchor'), ['0.85.3']);
  assert.throws(() => selectMatrix(policy, 'latest'), /unknown matrix selection/);
  for (const bad of ['latest','0.87','0.89.0-rc.0','0.89.0','0.86.3','0.87.1;echo x']) assert.throws(() => strictVersion(bad, policy));
  assert.throws(() => strictVersion('0.88.0', {...policy, lanes: {}}), /no lane toolchain/);
});

test('every lane carries the SDKs and Xcode its RN template needs', () => {
  for (const rn of selectMatrix(policy, 'support').concat(policy.anchor)) {
    const lane = policy.lanes[rn];
    assert.ok(lane.android.some(p => /^platforms;android-\d+(\.\d+)?$/.test(p)), rn);
    assert.ok(lane.android.some(p => /^build-tools;\d+\.\d+\.\d+$/.test(p)), rn);
    assert.ok(lane.android.some(p => /^ndk;\d+\.\d+\.\d+$/.test(p)), rn);
    assert.match(lane.ios.runner, /^macos-\d+$/); assert.match(lane.ios.xcode, /^\d+\.\d+(\.\d+)?$/);
  }
  assert.deepEqual(Object.keys(laneEntries(policy, 'stable')[0]).sort(), ['rn','runner','xcode']);
  assert.deepEqual(Object.keys(policy.lanes).sort(compareVersions), [...selectMatrix(policy, 'support'), ...policy.anchor].sort(compareVersions));
});

test('declared New Architecture window is uncapped and covered from its floor to the newest lane', () => {
  const manifest = require('../../package.json');
  for (const peer of ['react', 'react-native']) assert.match(manifest.peerDependencies[peer], /^>=\d+\.\d+\.\d+$/, `${peer} peer must not be capped`);
  const peerFloor = manifest.peerDependencies['react-native'].slice(2);
  assert.ok(compareVersions(peerFloor, policy.newArchitectureFloor) <= 0, 'peer range must include the whole New Architecture window');
  const support = selectMatrix(policy, 'support');
  const sorted = [...support].sort(compareVersions);
  assert.equal(sorted.at(-1), policy.stable[0], 'stable[0] must be the newest lane');
  const minor = v => v.split('.').slice(0, 2).join('.');
  assert.equal(minor(sorted[0]), minor(policy.newArchitectureFloor), 'oldest lane must be the New Architecture floor minor');
  assert.equal(compareVersions('0.76.10', '0.76.9') > 0 && compareVersions('0.88.0', '0.100.0') < 0, true);
});

test('release monitor fails only when npm latest is ahead of the newest lane', () => {
  const { assess } = require('./release-monitor.cjs');
  assert.equal(assess({ latest: policy.stable[0], next: '9.9.9-rc.0' }, policy).behind, false);
  assert.equal(assess({ latest: policy.stable[1] }, policy).behind, false);
  const [major, minor] = policy.stable[0].split('.').map(Number);
  assert.equal(assess({ latest: `${major}.${minor}.99` }, policy).behind, true);
  assert.equal(assess({ latest: `${major}.${minor + 1}.0` }, policy).behind, true);
  for (const latest of [undefined, '0.89.0-rc.1', 'x']) assert.throws(() => assess({ latest }, policy), /unexpected react-native latest/);
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
  assert.match(yaml,/runs-on: \$\{\{ matrix\.runner \}\}/); assert.match(yaml,/ubuntu-24.04/); assert.match(yaml,/cancel-in-progress: true/);
  assert.doesNotMatch(yaml,/continue-on-error|actions\/cache|pull_request_target|legacy-peer-deps|--force/);
  assert.match(yaml,/if:.*always\(\)/); assert.match(yaml,/native-ci\/contracts.test.cjs/);
  assert.match(yaml,/require\('\.\/scripts\/native-ci\/matrix.json'\)/);
  assert.match(yaml,/include: \$\{\{ fromJSON\(needs\.contracts\.outputs\.lanes\) \}\}/);
  assert.match(yaml,/DEVELOPER_DIR: \/Applications\/Xcode_\$\{\{ matrix\.xcode \}\}\.app/);
  assert.match(yaml,/schedule:/); assert.match(yaml,/release-monitor\.cjs/);
  // The monitor reports drift; it must not gate pull requests through the required check.
  assert.doesNotMatch(yaml,/needs: \[[^\]]*release-monitor/);
});

function aggregateJob() {
  const yaml = fs.readFileSync(path.join(__dirname, '../../.github/workflows/native-compat.yml'), 'utf8');
  const match = yaml.match(/^  required-native:\n((?: {4,}[^\n]*\n|\n)*)/m);
  assert.ok(match, 'native aggregate job must exist');
  return match[1];
}

test('workflow aggregate check names distinguish partial selections from stable coverage', async t => {
  const job = aggregateJob();
  const name = job.match(/^    name: (.+)$/m)?.[1];
  assert.ok(name, 'native aggregate check must have a name');
  const expression = name.match(/^\$\{\{\s*(.*?)\s*\}\}$/)?.[1];
  const required = 'Required native compatibility';
  for (const [event, selection, expected] of [
    ['pull_request', undefined, required],
    ['push', undefined, required],
    ['schedule', undefined, required],
    ['workflow_dispatch', 'stable', required],
    ['workflow_dispatch', 'support', required],
    ['workflow_dispatch', 'window', 'Native compatibility (window)'],
    ['workflow_dispatch', 'anchor', 'Native compatibility (anchor)'],
  ]) await t.test(`${event} ${selection ?? '(default)'}`, () => {
    // This expression's string equality, &&/|| and format have the same semantics
    // in JS for these string inputs; evaluate the actual workflow, not a copy.
    const actual = expression ? require('node:vm').runInNewContext(expression, {
      github: {event_name: event},
      inputs: selection === undefined ? {} : {selection},
      format: (template, value) => template.replace('{0}', value),
    }, {timeout: 1000}) : name;
    assert.equal(actual, expected);
  });
});

test('workflow aggregate fails when any native dependency fails, skips or cancels', () => {
  const job = aggregateJob();
  assert.match(job, /^    if: \$\{\{ always\(\) \}\}$/m);
  assert.match(job, /^    needs: \[contracts, android, ios\]$/m);
  const run = job.match(/^        run: (.+)$/m)?.[1];
  assert.ok(run, 'native aggregate must execute its status check');
  const success = {CONTRACTS: 'success', ANDROID: 'success', IOS: 'success'};
  for (const [key, dependency] of [['CONTRACTS', 'contracts'], ['ANDROID', 'android'], ['IOS', 'ios']]) {
    assert.ok(job.includes(key + ': ${{ needs.' + dependency + '.result }}'));
  }
  const execute = env => require('node:child_process').spawnSync('sh', ['-c', run], {
    env: {...process.env, ...env}, encoding: 'utf8',
  });
  assert.equal(execute(success).status, 0);
  for (const dependency of Object.keys(success)) {
    for (const result of ['failure', 'skipped', 'cancelled']) {
      const child = execute({...success, [dependency]: result});
      assert.equal(child.status, 1, `${dependency}=${result}: ${child.stderr}`);
    }
  }
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
    assert.ok(result.harness.some(({file})=>file==='scripts/native-ci/release-monitor.cjs'));
    for(const {file} of result.harness) assert.ok(fs.existsSync(path.join(__dirname,'../..',file)));
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});
