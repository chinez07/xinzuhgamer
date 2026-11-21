// JavaScript / render-security.test.cjs / Node.js / saída HTML de dados públicos.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Cartões da home escapam fotos, capa, nomes e identificador sem interpolar JavaScript',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
  const code=['escapeHtmlHome','createProductCard'].map(name=>html.match(new RegExp('function '+name+'\\([^]*?^\\}','m'))[0]).join('\n');
  const context={window:{},isFav:()=>false};vm.createContext(context);vm.runInContext(code,context);
  const attack='x" onerror="alert(1)',card=context.createProductCard({id:attack,title:'<script>x</script>',cover:attack,sellerPhoto:attack,seller:'<img>',sold:'<iframe>',price:20});
  assert.ok(card.includes('src="x&quot; onerror=&quot;alert(1)"'));
  assert.ok(!card.includes('src="x" onerror='));
  assert.ok(!card.includes('<script>'));assert.ok(!card.includes('<iframe>'));
  assert.ok(card.includes("toggleFav(this.getAttribute('data-id'), this)"));
});
