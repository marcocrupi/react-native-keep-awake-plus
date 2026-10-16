'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
function insist(value, message) { if (!value) throw new Error(message); }
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function digest(file, algorithm = 'sha256') { return crypto.createHash(algorithm).update(fs.readFileSync(file)).digest('hex'); }
function strictVersion(version, policy) {
  insist(/^\d+\.\d+\.\d+$/.test(version), `exact stable RN version required: ${version}`);
  insist([...policy.stable, ...policy.window, ...policy.anchor].includes(version), `RN ${version} absent from explicit matrix`);
  insist(policy.lanes?.[version]?.android?.length && policy.lanes[version].ios?.xcode, `RN ${version} has no lane toolchain`);
  return version;
}
// 'support' is the whole declared New Architecture window: current stable plus older boundaries.
const SELECTIONS = {stable:['stable'], window:['window'], anchor:['anchor'], support:['stable','window']};
function selectMatrix(policy, selection) {
  insist(Object.hasOwn(SELECTIONS, selection), `unknown matrix selection ${selection}`);
  const values = SELECTIONS[selection].flatMap(key => policy[key] ?? []); insist(values.length, 'empty matrix');
  return values.map(v => strictVersion(v, policy));
}
// One GitHub matrix entry per RN version, with the runner/Xcode its template requires.
function laneEntries(policy, selection) {
  return selectMatrix(policy, selection).map(rn => ({rn, runner: policy.lanes[rn].ios.runner, xcode: policy.lanes[rn].ios.xcode}));
}
function compareVersions(a, b) {
  const [x, y] = [a, b].map(v => v.split('.').map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}
function command(executable, args, options) {
  const {cwd,log,env={}}=options;
  fs.mkdirSync(path.dirname(log),{recursive:true});
  const prefix=`$ ${JSON.stringify([executable,...args])}\ncwd=${cwd}\n`;
  fs.appendFileSync(log,prefix); process.stdout.write(prefix);
  // File descriptors avoid buffered-output truncation and preserve the child's actual exit.
  const fd=fs.openSync(log,'a'); let r;
  try { r=cp.spawnSync(executable,args,{cwd,env:{...process.env,...env},stdio:['ignore',fd,fd]}); }
  finally { fs.closeSync(fd); }
  const status=Number.isInteger(r.status)?r.status:1;
  const end=`\nEXIT=${status}${r.signal?` SIGNAL=${r.signal}`:''}${r.error?` ERROR=${r.error.message}`:''}\n`;
  fs.appendFileSync(log,end); process.stdout.write(end);
  if(status!==0) process.stdout.write(fs.readFileSync(log,'utf8').split('\n').slice(-65).join('\n')+'\n');
  return {status,log};
}
function capture(executable,args,cwd) {
  const r=cp.spawnSync(executable,args,{cwd,encoding:'utf8',maxBuffer:32*1024*1024});
  insist(r.status===0, `${executable} ${args.join(' ')} failed (${r.status}): ${r.stderr??r.error}`);
  return r.stdout.trim();
}
async function runStages(stages) {
  for(const stage of stages) { const code=await stage.run(); insist(code===0, `${stage.name} failed (exit ${code})`); }
}
function files(dir, base=dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const p=path.join(dir,e.name); insist(!e.isSymbolicLink(),`unexpected symlink: ${p}`);
    return e.isDirectory()?files(p,base):[path.relative(base,p)];
  }).sort();
}
function verifyInstalled(reference,installed,tarball,consumer) {
  insist(fs.lstatSync(installed).isDirectory() && !fs.lstatSync(installed).isSymbolicLink(),'package must be physical, not linked');
  insist(fs.realpathSync(installed).startsWith(fs.realpathSync(path.join(consumer,'node_modules'))+path.sep),'package escaped consumer');
  for(const file of files(reference)) insist(digest(path.join(reference,file))===digest(path.join(installed,file)), `tarball bytes differ: ${file}`);
  const name=json(path.join(reference,'package.json')).name;
  const entry=json(path.join(consumer,'package-lock.json')).packages[`node_modules/${name}`];
  const integrity='sha512-'+crypto.createHash('sha512').update(fs.readFileSync(tarball)).digest('base64');
  insist(entry && !entry.link && entry.integrity===integrity && entry.resolved?.startsWith('file:'),'lock must resolve exact candidate tarball integrity');
  return {tarball,sha256:digest(tarball),integrity,installed:fs.realpathSync(installed),files:files(reference).map(file=>({file,sha256:digest(path.join(reference,file))}))};
}
function findIOSCodegen(base) {
  const found=['','ReactCodegen/'].map(prefix=>path.join(base,prefix,'ReactNativeKCKeepAwakeSpec/ReactNativeKCKeepAwakeSpec.h')).filter(p=>fs.existsSync(p));
  insist(found.length===1,'missing or ambiguous iOS package Codegen header');return found[0];
}
module.exports={findIOSCodegen,insist,json,digest,strictVersion,selectMatrix,laneEntries,compareVersions,command,capture,runStages,files,verifyInstalled};
