#!/usr/bin/env node
'use strict';
// Opt-in local evidence. Mutations are confined to a completed DISPOSABLE consumer,
// restored in finally, and every witness is followed by real regeneration/compilation.
const fs=require('node:fs');
const path=require('node:path');
const {insist,json,command,runStages,verifyInstalled}=require('./lib.cjs');
const [laneArgument,outputArgument]=process.argv.slice(2);
async function main() {
  insist(laneArgument&&outputArgument&&path.isAbsolute(laneArgument)&&path.isAbsolute(outputArgument),'absolute completed Android lane and fresh output directories required');
  const lane=path.resolve(laneArgument),output=path.resolve(outputArgument);
  insist(!fs.existsSync(output),'refuse existing negative-witness output');
  const result=json(path.join(lane,'result.json'));
  insist(result.status==='pass'&&result.platform==='android','completed disposable Android lane required');
  const consumer=path.join(lane,'NativeMatrix'),installed=result.provenance.installed,android=path.join(consumer,'android');
  insist(installed===path.join(consumer,'node_modules/@marcocrupi/react-native-keep-awake-plus'),'unexpected package location');
  insist(!fs.lstatSync(installed).isSymbolicLink(),'never mutate a linked package');
  fs.mkdirSync(output,{recursive:true});
  const witnesses=[];
  const execute=(name,exe,args,cwd)=>{
    const r=command(exe,args,{cwd,env:{NATIVE_CI_PACKAGE:installed},log:path.join(output,name+'.log')});
    witnesses.push({name,executable:exe,args,cwd,exit:r.status});return r.status;
  };
  const negative=async(name,run)=>{
    let reached=false;
    await require('node:assert/strict').rejects(runStages([{name,run:async()=>{return run();}},{name:'must-never-run',run:async()=>{reached=true;return 0;}}]),new RegExp(name));
    insist(!reached,`${name}: failure continued as GREEN`);
  };
  const npmDir=path.join(output,'npm-peer-mismatch');fs.mkdirSync(npmDir);
  fs.writeFileSync(path.join(npmDir,'package.json'),JSON.stringify({name:'negative-consumer',version:'0.0.0',private:true,dependencies:{react:'19.1.0','react-native':result.version,'@marcocrupi/react-native-keep-awake-plus':'file:'+result.tarball.path}},null,2)+'\n');
  await negative('npm-peer-mismatch',()=>execute('npm-peer-mismatch','npm',['install'],npmDir));
  const base=['--no-daemon','--no-build-cache','--no-configuration-cache','--max-workers=2','-PnewArchEnabled=true','-PreactNativeArchitectures=arm64-v8a'];
  const project=':marcocrupi_react-native-keep-awake-plus:';
  const spec=path.join(installed,'NativeKCKeepAwake.ts'),originalSpec=fs.readFileSync(spec);
  try {
    insist(originalSpec.toString().includes('activate: () => void;'),'unexpected candidate spec shape');
    fs.writeFileSync(spec,originalSpec.toString().replace('activate: () => void;', 'activate: (value: Date) => void;'));
    fs.rmSync(path.join(installed,'android/build/generated/source/codegen'),{recursive:true,force:true});
    await negative('codegen-invalid-spec',()=>execute('codegen-invalid-spec','./gradlew',[...base,project+'generateCodegenArtifactsFromSchema','--rerun-tasks'],android));
  } finally { fs.writeFileSync(spec,originalSpec); }
  insist(execute('codegen-restored','./gradlew',[...base,project+'generateCodegenArtifactsFromSchema','--rerun-tasks'],android)===0,'Codegen restore must be GREEN');
  const java=path.join(installed,'android/src/newarch/com/sayem/keepawake/KCKeepAwake.java'),originalJava=fs.readFileSync(java);
  try {
    fs.appendFileSync(java,'\nthis is deliberately invalid java !!!\n');
    await negative('build-invalid-java',()=>execute('build-invalid-java','./gradlew',[...base,project+'compileDebugJavaWithJavac','--rerun-tasks'],android));
  } finally { fs.writeFileSync(java,originalJava); }
  insist(execute('build-restored','./gradlew',[...base,project+'compileDebugJavaWithJavac','--rerun-tasks'],android)===0,'restored compiler must be GREEN');
  verifyInstalled(path.join(lane,'extracted/package'),installed,result.tarball.path,consumer);
  fs.writeFileSync(path.join(output,'witnesses.json'),JSON.stringify({status:'pass',witnesses,restoredTarballBytes:true},null,2)+'\n');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
