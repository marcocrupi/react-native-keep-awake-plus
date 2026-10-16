#!/usr/bin/env node
'use strict';
// The RN peer range has no upper bound, so the exact matrix must follow upstream releases.
// This check only reports drift; it never adds a version to the matrix by itself.
const fs=require('node:fs');
const {insist,compareVersions}=require('./lib.cjs');
const policy=require('./matrix.json');
const DIST_TAGS='https://registry.npmjs.org/-/package/react-native/dist-tags';
function assess(tags,policy) {
  insist(/^\d+\.\d+\.\d+$/.test(tags?.latest??''),`unexpected react-native latest tag: ${tags?.latest}`);
  const qualified=policy.stable[0];
  return {latest:tags.latest,next:tags.next??null,qualified,behind:compareVersions(tags.latest,qualified)>0};
}
async function main() {
  const response=await fetch(DIST_TAGS);
  insist(response.ok,`${DIST_TAGS} returned HTTP ${response.status}`);
  const result=assess(await response.json(),policy);
  const message=result.behind
    ? `React Native ${result.latest} is npm latest, but the newest qualified lane is ${result.qualified}. First prepare a candidate update to stable and lanes in matrix.json with its toolchain and contract expectations. Then run lane.cjs for it on Android and iOS; promote the update only after both lanes and the stable CI run pass.`
    : `React Native npm latest ${result.latest} is covered by the stable matrix (newest lane ${result.qualified}).`;
  console.log(JSON.stringify(result));
  console.log(message);
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## React Native release monitor\n\n${message}\n\nnext: \`${result.next??'none'}\`\n\n`);
  if(result.behind) process.exitCode=1;
}
if(require.main===module) main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={assess};
