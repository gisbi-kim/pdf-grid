"""Extract actual supplied Electron runtimes; add only a readiness observation hook."""
from pathlib import Path
import json, struct, subprocess, hashlib, copy, os
root=Path(__file__).resolve().parent.parent
inputs=root/'benchmark'/'inputs'
outputs=root/'benchmark'/'apps'
seven=Path(os.environ.get('ProgramFiles',r'C:\Program Files'))/'7-Zip'/'7z.exe'

def extract(source,dest):
 dest.mkdir(parents=True,exist_ok=True)
 subprocess.run([str(seven),'x','-y',f'-o{dest}',str(source)],check=True,stdout=subprocess.DEVNULL)

def instrument(folder,expected):
 asar=folder/'resources'/'app.asar'; b=asar.read_bytes(); size=struct.unpack_from('<I',b,12)[0]
 tree=json.loads(b[16:16+size]); base=8+struct.unpack_from('<I',b,4)[0]
 files={}
 def walk(node,prefix=''):
  for name,entry in node['files'].items():
   path=f'{prefix}/{name}' if prefix else name
   if 'files' in entry:yield from walk(entry,path)
   else:yield path,entry
 for name,entry in walk(tree):
  assert not entry.get('unpacked') and 'offset' in entry
  start=base+int(entry['offset']);files[name]=b[start:start+entry['size']]
 package=json.loads(files['package.json']);assert package['version']==expected,package
 probe=(root/'benchmark'/'probe.js').read_text()
 promise="new Promise(resolve=>{window.__pdfGridBenchSignal=stage=>{if(stage==='ready')resolve();};"+probe+"})"
 hook="\nconst __benchElectron=require('electron');\n__benchElectron.app.on('web-contents-created',(_event,contents)=>{contents.once('dom-ready',()=>{const uiAt=Date.now();contents.executeJavaScript("+json.dumps(promise)+").then(()=>{require('fs').writeFileSync(process.env.PDFGRID_BENCHMARK_RESULT,JSON.stringify({uiAt,readyAt:Date.now()}));const w=__benchElectron.BrowserWindow.fromWebContents(contents);if(w&&!w.isDestroyed())w.setTitle('PDF Grid [BENCH READY]');}).catch(console.error);});});\n"
 main=files['main.cjs'].decode()
 # Set an isolated user-data path before the original app.whenReady handlers.
 source="\nrequire('electron').app.setPath('userData',process.env.PDFGRID_BENCHMARK_PROFILE);\n"
 start=main.find("require('electron');")
 if start<0:start=main.find('require("electron");')
 assert start>=0
 end=main.index(';',start)+1
 main=main[:end]+source+main[end:]+hook
 files['main.cjs']=main.encode()
 payload=[];offset=0
 for name,entry in walk(tree):
  data=files[name];entry['offset']=str(offset);entry['size']=len(data);offset+=len(data);payload.append(data)
  if 'integrity' in entry:
   block=entry['integrity'].get('blockSize',4194304)
   entry['integrity']={'algorithm':'SHA256','hash':hashlib.sha256(data).hexdigest(),'blockSize':block,'blocks':[hashlib.sha256(data[i:i+block]).hexdigest() for i in range(0,len(data),block)]}
 header=json.dumps(tree,separators=(',',':'),ensure_ascii=False).encode();padding=b'\0'*((-len(header))%4)
 pickle=struct.pack('<II',4+len(header)+len(padding),len(header))+header+padding
 asar.write_bytes(struct.pack('<II',4,len(pickle))+pickle+b''.join(payload))
 return {'version':expected,'electron':(folder/'version').read_text().strip(),'originalExecutableSHA256':hashlib.sha256((folder/'PDF Grid.exe').read_bytes()).hexdigest(),'originalAsarSHA256':hashlib.sha256(b).hexdigest(),'instrumentedAsarSHA256':hashlib.sha256(asar.read_bytes()).hexdigest(),'changedFileInsideAsar':'main.cjs only; all browser/PDF assets and the Electron executable are byte-for-byte unchanged'}

expected={
 'PDF-Grid-Setup-Original-1.1.0.exe':'74a4d95db7c7cdc11edae702d8ba0c07b77a1ed3cb9f775cb4d8056e93735eb6',
 'original-1.3.3.7z':'5771fb8978a6da93d6ec4100ff3a4b71a1a27248a676a433079bf53b2f0fb921'}
for name,digest in expected.items():assert hashlib.sha256((inputs/name).read_bytes()).hexdigest()==digest,name
extract(inputs/'PDF-Grid-Setup-Original-1.1.0.exe',inputs/'outer-1.1.0')
extract(inputs/'outer-1.1.0'/'$PLUGINSDIR'/'app-64.7z',outputs/'1.1.0')
extract(inputs/'original-1.3.3.7z',outputs/'1.3.3')
info=[instrument(outputs/v,v) for v in ['1.1.0','1.3.3']]
(root/'benchmark'/'provenance.json').write_text(json.dumps(info,indent=2))
print(json.dumps(info,indent=2))
