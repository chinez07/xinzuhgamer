// JavaScript / background-settings.js / navegador e Node.js / preferências privadas de fundo.
(function(root){
  'use strict';
  var presets={desktop:[{url:'/assets/fundos/minecraft-pc.jpg',name:'Minecraft · Steve e axolotes'},{url:'/assets/fundos/ghost-pc.jpg',name:'Call of Duty · Ghost'}],mobile:[{url:'/assets/fundos/minecraft-mobile-1.jpg',name:'Minecraft · Aventura'},{url:'/assets/fundos/minecraft-mobile-2.jpg',name:'Minecraft · Abelhas'}]};
  function image(value){return typeof value==='string'&&value.length<=180000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:'';}
  function normalize(value,legacy){
    value=value&&typeof value==='object'?value:{};
    var result={};
    ['desktop','mobile'].forEach(function(device){
      var row=value[device]||{},fallback=Number.isInteger(legacy)&&legacy>=0?legacy%2:-1;
      result[device]={preset:Number.isInteger(row.preset)&&row.preset>=-1&&row.preset<2?row.preset:fallback,custom:image(row.custom)};
    });
    return result;
  }
  function pick(value,device){var row=normalize(value)[device];return row.custom||(row.preset>=0?presets[device][row.preset].url:'');}
  async function readFile(file){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
    if(file.size>10*1024*1024)throw new Error('A imagem deve ter até 10 MB.');
    var url=URL.createObjectURL(file),img=new Image();
    try{
      await new Promise(function(resolve,reject){img.onload=resolve;img.onerror=function(){reject(new Error('Não foi possível abrir essa imagem.'));};img.src=url;});
      if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>40000000)throw new Error('Escolha uma imagem com até 40 megapixels.');
      var canvas=document.createElement('canvas'),scale=Math.min(1,1920/Math.max(img.naturalWidth,img.naturalHeight));
      for(var pass=0;pass<5;pass++){
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        var context=canvas.getContext('2d');context.fillStyle='#0f0f14';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
        for(var quality=.88;quality>=.46;quality-=.14){var result=canvas.toDataURL('image/jpeg',quality);if(result.length<=180000)return result;}
        scale*=.75;
      }
      throw new Error('A imagem é muito detalhada. Escolha uma versão menor.');
    }finally{URL.revokeObjectURL(url);}
  }
  var api={presets:presets,normalize:normalize,pick:pick,readFile:readFile};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BloxzuhBackgrounds=api;
})(typeof window==='undefined'?globalThis:window);
