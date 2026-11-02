/* ===================== ofir-lab-link/v1 (shared by Circuit Lab and Control Block Lab) =====================
 Envelope: {schema:'ofir-lab-link/v1', app:'circuit-lab'|'control-block-lab', kind:'circuit'|'block-diagram',
            title, template?, notes?:{he,en}, data:{...}, createdAt, ...any unknown keys are preserved}
 Deep link: <app-url>/#link=<base64url(JSON envelope)>
*/
const LINK_SCHEMA='ofir-lab-link/v1';
const LINK_URLS={'circuit-lab':'https://circuit-lab-ofir.surge.sh/','control-block-lab':'https://control-block-lab-ofir.surge.sh/'};
const LINK_KNOWN=['schema','app','kind','title','template','notes','data','createdAt'];
function linkEnvelope(app,kind,data,opts){
 const o=Object.assign({},opts&&opts.extra||{});
 Object.assign(o,{schema:LINK_SCHEMA,app,kind,title:(opts&&opts.title)||'',data,createdAt:new Date().toISOString()});
 if(opts&&opts.template)o.template=opts.template;if(opts&&opts.notes)o.notes=opts.notes;
 return o;
}
function linkUnknownKeys(env){return Object.keys(env).filter(k=>!LINK_KNOWN.includes(k));}
function linkEncode(env){const s=unescape(encodeURIComponent(JSON.stringify(env)));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function linkDecode(b){b=b.replace(/-/g,'+').replace(/_/g,'/');while(b.length%4)b+='=';return JSON.parse(decodeURIComponent(escape(atob(b))));}
function linkURL(targetApp,env){return LINK_URLS[targetApp]+'#link='+linkEncode(env);}
function linkFromHash(){const m=(location.hash||'').match(/#link=([A-Za-z0-9_\-]+)/);if(!m)return null;try{return linkDecode(m[1]);}catch(e){return {error:true};}}
function linkClearHash(){try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}}
