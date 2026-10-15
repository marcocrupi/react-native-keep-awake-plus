#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {insist,json,digest,strictVersion,command,capture,runStages,files,verifyInstalled,findIOSCodegen}=require('./lib.cjs');
const policy=require('./matrix.json');
const root=path.resolve(__dirname,'../..');
const [platform,version,workArgument]=process.argv.slice(2);
async function main() {
  insist(['android','ios'].includes(platform),'usage: lane.cjs android|ios EXACT_RN ABSOLUTE_NEW_DIRECTORY');
  strictVersion(version,policy);
  insist(workArgument && path.isAbsolute(workArgument),'an absolute, fresh external directory is required');
  const work=path.resolve(workArgument);
  insist(!work.startsWith(root+path.sep) && work!==root,'consumer and artifacts must be outside checkout');
  insist(!fs.existsSync(work),'refuse existing directory (no stale codegen/build success)');
  fs.mkdirSync(work,{recursive:true});
  const logdir=path.join(work,'logs'); fs.mkdirSync(logdir);
  const consumer=path.join(work,'NativeMatrix');
  const reference=path.join(work,'extracted','package');
  const packageName=json(path.join(root,'package.json')).name;
  const installed=path.join(consumer,'node_modules',packageName);
  const result={platform,version,status:'running',startedAt:new Date().toISOString(),checkout:root,head:capture('git',['rev-parse','HEAD'],root),diff:capture('git',['status','--porcelain=v1','--untracked-files=all'],root),commands:[]};
  result.harness=[...files(__dirname).map(file=>path.join('scripts/native-ci',file)),'.github/workflows/native-compat.yml'].map(file=>({file,sha256:digest(path.join(root,file))}));
  let tarball;
  const summary=()=>{if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## Native ${platform} RN ${version}\n\nStatus: **${result.status}**; New Architecture.\n\nCandidate tarball SHA-256: \`${result.tarball?.sha256??'not packed'}\`.\n\nCommands, exact locks, source hashes and compiler/test evidence are in the native artifact.\n\n`);};
  const save=()=>fs.writeFileSync(path.join(work,'result.json'),JSON.stringify(result,null,2)+'\n');
  const run=(name,exe,args,cwd=consumer,env={})=>{
    const r=command(exe,args,{cwd,env,log:path.join(logdir,name+'.log')});
    result.commands.push({name,executable:exe,args,cwd,exit:r.status,log:r.log});save();return r.status;
  };
  const must=(name,exe,args,cwd=consumer,env={})=>insist(run(name,exe,args,cwd,env)===0,`${name} failed; see logs`);
  save();
  try {
    insist(process.versions.node===policy.node,`Node ${policy.node} required, got ${process.versions.node}`);
    insist(capture('npm',['--version'],root)===policy.npm,`npm ${policy.npm} required`);
    // Reject user/global/environment bypasses before generating the disposable consumer.
    for(const name of ['legacy-peer-deps','force','ignore-scripts']) insist(capture('npm',['config','get',name],work)==='false',`forbidden inherited npm ${name}`);
    insist(capture('npm',['config','get','registry'],work)==='https://registry.npmjs.org/','official npm registry required');
    result.toolchain={node:process.version,npm:policy.npm,os:os.type(),release:os.release(),arch:os.arch(),cli:policy.cli};save();
    must('pack','npm',['pack','--json','--pack-destination',work],root);
    const packs=fs.readdirSync(work).filter(n=>n.endsWith('.tgz'));insist(packs.length===1,'expected exactly one npm tarball');
    tarball=path.join(work,packs[0]);fs.mkdirSync(path.dirname(reference),{recursive:true});
    must('extract','tar',['-xzf',tarball,'-C',path.dirname(reference)],work);
    insist(!fs.existsSync(path.join(reference,'android/build')),'tarball contains stale native output');
    result.tarball={path:tarball,sha256:digest(tarball)};save();
    must('init','npx',['--yes',`@react-native-community/cli@${policy.cli}`,'init','NativeMatrix','--version',version,'--directory',consumer,'--skip-install','--skip-git-init','--install-pods','false','--pm','npm'],work);
    insist(json(path.join(consumer,'package.json')).dependencies['react-native']===version,'template RN version drift');
    fs.writeFileSync(path.join(consumer,'App.tsx'),`import React from 'react';\nimport {View} from 'react-native';\nimport KeepAwake from '${packageName}';\nexport default function App() { return <View><KeepAwake /></View>; }\n`);
    for(const name of ['legacy-peer-deps','force','ignore-scripts']) insist(capture('npm',['config','get',name],consumer)==='false',`forbidden consumer npm ${name}`);
    await runStages([{name:'npm-install',run:async()=>run('npm-install','npm',['install','--save-exact',tarball])}]);
    must('npm-ls','npm',['ls','--all','--json']);
    insist(json(path.join(consumer,'node_modules/react-native/package.json')).version===version,'installed RN drift');
    result.provenance=verifyInstalled(reference,installed,tarball,consumer);save();
    const configLog=path.join(logdir,'autolinking.json');
    fs.writeFileSync(configLog,capture(process.execPath,[path.join(consumer,'node_modules/@react-native-community/cli/build/bin.js'),'config'],consumer)+'\n');
    const dependency=json(configLog).dependencies[packageName];
    insist(dependency && fs.realpathSync(dependency.root)===fs.realpathSync(installed),'autolinking resolved foreign package');
    insist(dependency.platforms.android && dependency.platforms.ios,'package absent from native autolinking');
    if(platform==='android') {
      const android=path.join(consumer,'android');
      const gradleProperties=fs.readFileSync(path.join(android,'gradle.properties'),'utf8');
      insist(/^newArchEnabled=true$/m.test(gradleProperties),'template must enable New Architecture');
      const generated=path.join(installed,'android/build/generated/source/codegen');
      insist(!fs.existsSync(generated),'Codegen must start absent');
      const base=['--no-daemon','--no-build-cache','--no-configuration-cache','--max-workers=2','-PreactNativeArchitectures=arm64-v8a','-PnewArchEnabled=true','-I',path.join(__dirname,'consumer.init.gradle')];
      const project=':marcocrupi_react-native-keep-awake-plus:';
      const env={NATIVE_CI_PACKAGE:installed};
      must('java-version','java',['-version'],android);
      must('gradle-version','./gradlew',['--version'],android,env);
      await runStages([
        {name:'codegen',run:async()=>run('codegen','./gradlew',[...base,project+'generateCodegenArtifactsFromSchema','--rerun-tasks'],android,env)},
        {name:'codegen-proof',run:async()=>{insist(fs.existsSync(path.join(generated,'java/com/sayem/keepawake/NativeKCKeepAwakeSpec.java')),'Codegen returned 0 without generated spec');return 0;}},
        {name:'lifecycle-and-build',run:async()=>run('lifecycle-and-build','./gradlew',[...base,project+'testDebugUnitTest',':app:assembleDebug',':app:assembleRelease'],android,env)},
        {name:'compiled-provenance',run:async()=>run('compiled-provenance','./gradlew',[...base,project+'verifyNativeMatrix'],android,env)}
      ]);
      const reports=files(path.join(installed,'android/build/test-results/testDebugUnitTest')).filter(n=>n.endsWith('.xml'));
      for(const name of ['Lifecycle','Regression','Deadlock']) {
        const report=reports.find(n=>n.endsWith(`KCKeepAwake${name}Test.xml`));insist(report,`missing ${name} lifecycle report`);
        const xml=fs.readFileSync(path.join(installed,'android/build/test-results/testDebugUnitTest',report),'utf8');
        insist(/tests="[1-9]\d*"/.test(xml)&&/failures="0"/.test(xml)&&/errors="0"/.test(xml)&&/skipped="0"/.test(xml),`non-green or skipped lifecycle suite ${name}`);
      }
      fs.cpSync(path.join(installed,'android/build/test-results/testDebugUnitTest'),path.join(work,'test-results'),{recursive:true});
      for(const variant of ['debug','release']) {
        const dir=path.join(android,'app/build/outputs/apk',variant);
        const apks=fs.readdirSync(dir).filter(n=>n.endsWith('.apk'));insist(apks.length===1,`missing ${variant} APK`);
        const apk=path.join(dir,apks[0]);const listing=capture('unzip',['-Z1',apk],android);
        insist(listing.includes('lib/arm64-v8a/'),'APK lacks arm64 native libraries');
        insist(!/lib\/(?:x86|x86_64|armeabi-v7a)\//.test(listing),'unexpected extra APK ABI');
        const dexFiles=listing.split('\n').filter(n=>/^classes\d*\.dex$/.test(n));
        insist(dexFiles.length>0,'APK has no DEX');
        const dex=dexFiles.map(n=>capture('unzip',['-p',apk,n],android)).join('');
        for(const name of ['KCKeepAwake','KCKeepAwakePackage','NativeKCKeepAwakeSpec']) insist(dex.includes('Lcom/sayem/keepawake/'+name+';'),`APK ${variant} omits ${name}`);
        result[variant]={apk,sha256:digest(apk)};
      }
      // Autolinking generated by the build, not just CLI config.
      const link=fs.readFileSync(path.join(android,'app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java'),'utf8');
      insist(link.includes('KCKeepAwakePackage'),'compiled app omitted autolinked package');
    } else {
      insist(process.platform==='darwin','iOS requires macOS');
      const ios=path.join(consumer,'ios');
      insist(!fs.existsSync(path.join(ios,'Pods'))&&!fs.existsSync(path.join(ios,'build')),'Pods and Codegen must start absent');
      result.toolchain.xcode=capture('xcodebuild',['-version'],ios);
      result.toolchain.cocoapods=capture('pod',[`_${policy.cocoapods}_`,'--version'],ios);save();
      const env={RCT_NEW_ARCH_ENABLED:'1',RCT_USE_PREBUILT_RNCORE:'1',RCT_USE_RN_DEP:'1'};
      await runStages([
        {name:'pods-codegen',run:async()=>run('pods-codegen','pod',[`_${policy.cocoapods}_`,'install'],ios,env)},
        {name:'codegen-proof',run:async()=>{result.codegenHeader=findIOSCodegen(path.join(ios,'build/generated/ios'));return 0;}},
        {name:'simulator-build',run:async()=>run('simulator-build','xcodebuild',['-workspace','NativeMatrix.xcworkspace','-scheme','NativeMatrix','-configuration','Debug','-sdk','iphonesimulator','-destination','generic/platform=iOS Simulator','-derivedDataPath',path.join(work,'DerivedData'),'CODE_SIGNING_ALLOWED=NO','ARCHS=arm64','ONLY_ACTIVE_ARCH=YES','-jobs','2','build'],ios,env)}
      ]);
      const podspec=json(path.join(ios,'Pods/Local Podspecs/react-native-keep-awake.podspec.json'));
      insist(podspec.version===json(path.join(reference,'package.json')).version,'wrong installed pod version');
      insist(podspec.compiler_flags?.includes('-DRCT_NEW_ARCH_ENABLED=1'),'package pod was not compiled for New Architecture');
      const lock=fs.readFileSync(path.join(ios,'Podfile.lock'),'utf8');
      insist(lock.includes('react-native-keep-awake:')&&lock.includes(`../node_modules/${packageName}`),'Pods did not resolve candidate node_modules');
      const xcodeLog=fs.readFileSync(path.join(logdir,'simulator-build.log'),'utf8');
      insist(xcodeLog.includes('ReactNativeKCKeepAwake.mm')&&xcodeLog.includes('react-native-keep-awake.build'),'missing native package compiler evidence');
      const objects=files(path.join(work,'DerivedData/Build/Intermediates.noindex/Pods.build')).filter(n=>n.endsWith('/ReactNativeKCKeepAwake.o'));
      insist(objects.length>0,'package Objective-C++ object missing');
      const app=path.join(work,'DerivedData/Build/Products/Debug-iphonesimulator/NativeMatrix.app/NativeMatrix');
      insist(fs.existsSync(app),'simulator app executable missing');
      const linked=fs.existsSync(app+'.debug.dylib')?app+'.debug.dylib':app;
      const symbols=capture('nm',['-g',linked],ios);
      insist(symbols.includes('OBJC_CLASS_$_ReactNativeKCKeepAwake'),'simulator app did not link native package class');
      fs.writeFileSync(path.join(logdir,'linked-package-symbols.txt'),symbols.split('\n').filter(n=>/KCKeepAwake/.test(n)).join('\n')+'\n');
      result.simulator={app,linked,sha256:digest(linked),objects};
      fs.copyFileSync(path.join(ios,'Podfile.lock'),path.join(work,'Podfile.lock'));
    }
    result.provenance=verifyInstalled(reference,installed,tarball,consumer);
    result.status='pass';result.completedAt=new Date().toISOString();save();summary();
  } catch(error) { result.status='fail';result.error=error.stack;result.completedAt=new Date().toISOString();save();summary();throw error; }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
