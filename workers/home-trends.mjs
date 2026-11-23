// JavaScript / home-trends.mjs / Cloudflare Workers / ranking público sem dados dos pedidos.
const TREND_WEEK=7*86400000;
const trendCache=new WeakMap();
export function trendCategory(ad={}) {
  const key=String(ad.subcategory||ad.category||'').toLowerCase().replace(/\s+/g,'');
  const categories={roblox:'roblox',freefire:'freefire',valorant:'valorant',fortnite:'fortnite',leagueoflegends:'lol',lol:'lol',cs2:'cs2',genshinimpact:'genshin',genshin:'genshin'};
  return Object.hasOwn(categories,key)?categories[key]:'';
}
export function rankCompletedGames(orders,now=Date.now()) {
  const counts=new Map(),seen=new Set();
  for(const order of orders) {
    if(!order.id||seen.has(order.id)||order.secureVersion!==1||order.paymentVerified!==true||order.status!=='concluido'||!Number.isFinite(order.completedAtMs)||order.completedAtMs<now-TREND_WEEK||order.completedAtMs>now)continue;
    seen.add(order.id);
    const category=trendCategory({category:order.discoveryCategory});
    if(category)counts.set(category,(counts.get(category)||0)+1);
  }
  return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3).map(([category])=>category);
}
export async function homeTrends(db,env,now=Date.now()) {
  const key=env,previous=trendCache.get(key);
  if(previous&&previous.expires>now)return previous.promise;
  const promise=(async()=>{
    const orders=[],adCategories=new Map();let cursor=null;
    do {
      const page=await db.recentCompletedOrders(now-TREND_WEEK,cursor);
      for(const doc of page.documents) {
        const order=doc.data;
        if(order.secureVersion!==1||order.paymentVerified!==true||order.status!=='concluido')continue;
        let category=order.discoveryCategory;
        if(!category&&/^[A-Za-z0-9_-]{1,128}$/.test(order.adId||'')) {
          if(!adCategories.has(order.adId))adCategories.set(order.adId,trendCategory((await db.get('ads/'+order.adId)).data||{}));
          category=adCategories.get(order.adId);
        }
        orders.push({...order,id:doc.path,discoveryCategory:category});
      }
      cursor=page.nextCursor;
    }while(cursor);
    return {categories:rankCompletedGames(orders,now),windowDays:7,generatedAtMs:now};
  })();
  trendCache.set(key,{expires:now+300000,promise});
  try{return await promise;}catch(error){trendCache.delete(key);throw error;}
}
