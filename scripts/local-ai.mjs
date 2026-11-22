// JavaScript / local-ai.mjs / Node.js no Windows / acesso privado e limitado ao Workers AI.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {MODERATION_MODELS} from '../workers/moderation-ai.mjs';
export async function createLocalAI(folder,fetcher=fetch) {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID||'0664a27a6f39fb85af416d5ec5710941';
  if(!/^[a-f0-9]{32}$/.test(account))throw Error('ID da conta Cloudflare inválido.');
  let token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token){
    const credential=path.join(folder,'cloudflare-ai.dpapi');await fs.access(credential);
    const script="$secure=(Get-Content -LiteralPath '"+credential.replace(/'/g,"''")+"' -Raw).Trim() | ConvertTo-SecureString; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }";
    const result=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:10000});
    if(result.status!==0)throw Error('Não foi possível abrir a credencial protegida para este usuário do Windows.');
    token=result.stdout.trim();
  }
  if(!/^[A-Za-z0-9_-]{20,200}$/.test(token))throw Error('Credencial privada inválida.');
  const usageFile=path.join(folder,'ai-usage.json'),statusFile=path.join(folder,'ai-status.json');
  let usage;try{usage=JSON.parse(await fs.readFile(usageFile,'utf8'));}catch{usage={};}
  const dailyLimit=20;
  async function status(value){await fs.writeFile(statusFile,JSON.stringify({...value,checkedAt:new Date().toISOString()}));}
  return {
    async verify(){
      const response=await fetcher('https://api.cloudflare.com/client/v4/user/tokens/verify',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
      const body=await response.json();const active=response.ok&&body.success===true&&body.result?.status==='active';
      await status({connected:active,model:MODERATION_MODELS.primary,tokenExpires:body.result?.expires_on||null,calls:usage.day===new Date().toISOString().slice(0,10)?usage.calls:0,dailyLimit});
      return {active,expires:body.result?.expires_on||null};
    },
    async run(model,body){
      if(!Object.values(MODERATION_MODELS).includes(model))throw Error('Modelo não autorizado para a prévia.');
      const day=new Date().toISOString().slice(0,10);if(usage.day!==day)usage={day,calls:0};
      if(usage.calls>=dailyLimit){await status({connected:true,model,limitReached:true,calls:usage.calls,dailyLimit});throw Error('Limite local de 20 chamadas de IA por dia atingido.');}
      usage.calls++;await fs.writeFile(usageFile,JSON.stringify(usage));
      const response=await fetcher('https://api.cloudflare.com/client/v4/accounts/'+account+'/ai/run/'+model,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
      const result=await response.json();
      if(!response.ok||result.success===false){
        await status({connected:false,model,status:response.status,errorCodes:(result.errors||[]).map(e=>e.code),message:(result.errors||[]).map(e=>String(e.message||'').slice(0,200)).join('; '),calls:usage.calls,dailyLimit});
        throw Error('Workers AI indisponível. Consulte o status local.');
      }
      await status({connected:true,model,calls:usage.calls,dailyLimit,usage:result.result?.usage||result.usage||null});
      return result.result||result;
    }
  };
}
