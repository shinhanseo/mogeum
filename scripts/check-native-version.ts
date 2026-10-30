/** Verify native artifact identity/version, independently of EAS metadata and Expo JS constants. */
import {execFileSync} from "node:child_process";
import {mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir,homedir} from "node:os";
import {join,resolve} from "node:path";
const [file,expectedBuild,expectedPlatform]=process.argv.slice(2);
const platforms=["android","ios-device","ios-simulator"];
if(!file||!/^\d+(?:\.\d+){0,2}$/.test(expectedBuild??"")||!platforms.includes(expectedPlatform))throw Error("Usage: beta:native <apk|ipa|app> <expected build> <android|ios-device|ios-simulator>");
const run=(program:string,args:string[])=>execFileSync(program,args,{encoding:"utf8",maxBuffer:16*1024*1024,stdio:["ignore","pipe","pipe"]});
let temporary:string|undefined;
try{
 const path=resolve(file);let id:string,version:string,build:string,platform:string;
 if(path.endsWith(".apk")){
  const sdk=process.env.ANDROID_HOME??join(homedir(),"Library/Android/sdk");
  const tools=join(sdk,"build-tools");
  const release=readdirSync(tools).filter(v=>/^\d+\.\d+\.\d+$/.test(v)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0];
  if(!release)throw Error("ANDROID_BUILD_TOOLS_MISSING");
  const tool=join(tools,release);
  run(join(tool,"apksigner"),["verify",path]);
  const metadata=run(join(tool,"aapt2"),["dump","badging",path]);
  const packageLines=metadata.split("\n").filter(line=>line.startsWith("package: "));
  if(packageLines.length!==1)throw Error("AMBIGUOUS_PACKAGE");
  const field=(name:string)=>{const matched=packageLines[0].match(new RegExp(`(?:^| )${name}='([^']+)'`));if(!matched)throw Error("MISSING_PACKAGE_FIELD");return matched[1];};
  id=field("name");build=field("versionCode");version=field("versionName");platform="android";
 }else{
  let plist:string;
  if(path.endsWith(".ipa")){
   const entries=run("unzip",["-Z","-1",path]).split("\n").filter(name=>/^Payload\/[^/]+\.app\/Info\.plist$/.test(name));
   if(entries.length!==1)throw Error("AMBIGUOUS_APP_PAYLOAD");
   temporary=mkdtempSync(join(tmpdir(),"mogeum-native-version-"));plist=join(temporary,"Info.plist");
   writeFileSync(plist,execFileSync("unzip",["-p",path,entries[0]],{maxBuffer:2*1024*1024,stdio:["ignore","pipe","pipe"]}),{mode:0o600});
  }else if(path.endsWith(".app"))plist=join(path,"Info.plist");
  else throw Error("UNSUPPORTED_NATIVE_ARTIFACT");
  // Force existence before asking plutil to inspect; output contains metadata only.
  readFileSync(plist);
  const field=(name:string)=>run("/usr/bin/plutil",["-extract",name,"raw","-o","-",plist]).trim();
  id=field("CFBundleIdentifier");version=field("CFBundleShortVersionString");build=field("CFBundleVersion");
  const supported=JSON.parse(run("/usr/bin/plutil",["-extract","CFBundleSupportedPlatforms","json","-o","-",plist]));
  platform=JSON.stringify(supported)===JSON.stringify(["iPhoneOS"])?"ios-device":JSON.stringify(supported)===JSON.stringify(["iPhoneSimulator"])?"ios-simulator":"unknown";
 }
 const matches=id==="com.hanseo.mogeum"&&build===expectedBuild&&platform===expectedPlatform;
 console.log(JSON.stringify({id,version,build,platform,expectedBuild,expectedPlatform,matches}));
 if(!matches)process.exitCode=1;
}catch{
 console.error("Native artifact verification failed; no file contents or command output logged.");process.exitCode=1;
}finally{if(temporary)rmSync(temporary,{recursive:true,force:true});}
