// JavaScript / start-preview-ai.mjs / Node.js no Windows / inicia ou reinicia apenas a prévia Bloxzuh.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),folder=path.join(root,'.local-preview');
if(!fs.existsSync(path.join(folder,'cloudflare-ai.dpapi')))throw Error('Configure primeiro a credencial privada de IA.');
const stop="$ErrorActionPreference='Stop';$listeners=Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue;foreach($listener in $listeners){$proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess);if($proc.CommandLine -notlike '*scripts/preview-moderation.mjs*'){throw 'A porta esta em uso por outro aplicativo.'};Stop-Process -Id $listener.OwningProcess}";
const result=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',stop],{encoding:'utf8',windowsHide:true});
if(result.status!==0)throw Error('Não foi possível reiniciar a prévia local. Feche o servidor anterior e tente novamente.');
const out=fs.openSync(path.join(folder,'server.log'),'a'),err=fs.openSync(path.join(folder,'server-error.log'),'a');
const server=spawn(process.execPath,['scripts/preview-moderation.mjs','--vision'],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out,err]});server.unref();fs.closeSync(out);fs.closeSync(err);
console.log('Prévia com IA iniciada: http://127.0.0.1:8789/');
