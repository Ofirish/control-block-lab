/* ===================== Control Block Lab — engine (pure, no DOM) ===================== */
/* ---------- multivariate polynomials: {monoKey: coef} ; monoKey "G1^1*H1^1" ("" = constant) ---------- */
const EPS=1e-12;
function monoParse(k){const o={};if(!k)return o;for(const t of k.split('*')){const i=t.lastIndexOf('^');o[t.slice(0,i)]=+t.slice(i+1);}return o;}
function monoKey(o){return Object.keys(o).filter(v=>o[v]).sort().map(v=>v+'^'+o[v]).join('*');}
function monoMul(a,b){const A=monoParse(a),B=monoParse(b);for(const v in B)A[v]=(A[v]||0)+B[v];return monoKey(A);}
function monoDeg(k){const o=monoParse(k);let d=0;for(const v in o)d+=o[v];return d;}
const Poly={
 c(v){return Math.abs(v)<EPS?{}:{'':v};},
 v(name){return {[name+'^1']:1};},
 clean(p){const o={};for(const k in p)if(Math.abs(p[k])>EPS*Math.max(1,Math.abs(p[k])))o[k]=p[k];return o;},
 add(a,b){const o={...a};for(const k in b)o[k]=(o[k]||0)+b[k];return Poly.clean(o);},
 scale(a,s){const o={};for(const k in a)o[k]=a[k]*s;return Poly.clean(o);},
 mul(a,b){const o={};for(const i in a)for(const j in b){const k=monoMul(i,j);o[k]=(o[k]||0)+a[i]*b[j];}return Poly.clean(o);},
 isZero(a){return Object.keys(a).length===0;},
 isConst(a){const k=Object.keys(a);return k.length===0||(k.length===1&&k[0]==='');},
 cval(a){return a['']||0;},
 key(a){return Object.keys(a).sort().map(k=>k+'='+(+a[k].toPrecision(12))).join('|');},
 lead(a){ // leading term by lex order on keys (deterministic)
  const ks=Object.keys(a).sort((x,y)=>{const dx=monoDeg(x),dy=monoDeg(y);return dy-dx||(x<y?-1:x>y?1:0);});return ks[0];},
 vars(a){const s=new Set();for(const k in a)for(const v in monoParse(k))s.add(v);return s;},
 eval(a,env){let s=0;for(const k in a){let t=a[k];const o=monoParse(k);for(const v in o)t*=Math.pow(env[v],o[v]);s+=t;}return s;},
 // exact division a / b (returns quotient or null) using lex leading terms
 div(a,b){
  const lb=Poly.lead(b),cb=b[lb],mb=monoParse(lb);let r={...a},q={};
  for(let guard=0;guard<500&&!Poly.isZero(r);guard++){
   const lr=Poly.lead(r),mr=monoParse(lr);const qm={};
   for(const v in mb){if((mr[v]||0)<mb[v])return null;}
   for(const v in mr)qm[v]=mr[v]-(mb[v]||0);
   const qk=monoKey(qm),qc=r[lr]/cb;const t={[qk]:qc};
   q=Poly.add(q,t);r=Poly.add(r,Poly.scale(Poly.mul(t,b),-1));
  }
  return Poly.isZero(r)?q:null;
 }
};
/* ---------- rational functions as products of factors: {c, n:[poly], d:[poly]} ---------- */
function normFactors(list){
 let c=1;const fs=[];
 for(const p0 of list){
  const p=Poly.clean(p0);const ks=Object.keys(p);
  if(ks.length===0){c=0;continue;}
  if(Poly.isConst(p)){c*=p[''];continue;}
  if(ks.length===1){c*=p[ks[0]];const o=monoParse(ks[0]);for(const v of Object.keys(o).sort())for(let i=0;i<o[v];i++)fs.push(Poly.v(v));continue;}
  const lc=p[Poly.lead(p)];c*=lc;fs.push(Poly.scale(p,1/lc));
 }
 return {c,fs};
}
const RF={
 mk(c,n,d){
  const N=normFactors(n),D=normFactors(d);
  if(D.c===0)throw new Error('division by zero');
  let cc=c*N.c/D.c;if(Math.abs(cc)<EPS)return {c:0,n:[],d:[]};
  let nn=N.fs,dd=D.fs;
  // cancel identical factors
  for(let i=0;i<nn.length;i++){const k=Poly.key(nn[i]);const j=dd.findIndex(f=>Poly.key(f)===k);if(j>=0){nn.splice(i,1);dd.splice(j,1);i--;}}
  // cancel by exact division of multi-term numerator factors
  for(let i=0;i<nn.length;i++){if(Object.keys(nn[i]).length<2)continue;
   for(let j=0;j<dd.length;j++){const q=Poly.div(nn[i],dd[j]);if(q){const r=normFactors([q]);cc*=r.c;nn.splice(i,1,...r.fs);dd.splice(j,1);i=-1;break;}}}
  for(let j=0;j<dd.length;j++){if(Object.keys(dd[j]).length<2)continue;
   for(let i=0;i<nn.length;i++){const q=Poly.div(dd[j],nn[i]);if(q){const r=normFactors([q]);cc/=r.c;dd.splice(j,1,...r.fs);nn.splice(i,1);j=-1;break;}}}
  return {c:cc,n:nn,d:dd};
 },
 num(v){return RF.mk(v,[],[]);},
 sym(name){return RF.mk(1,[Poly.v(name)],[]);},
 mul(a,b){return RF.mk(a.c*b.c,[...a.n,...b.n],[...a.d,...b.d]);},
 div(a,b){if(b.c===0)throw new Error('division by zero');return RF.mk(a.c/b.c,[...a.n,...b.d],[...a.d,...b.n]);},
 neg(a){return {c:-a.c,n:a.n,d:a.d};},
 isZero(a){return a.c===0;},
 add(a,b){
  if(a.c===0)return b;if(b.c===0)return a;
  const cnt={},keyOf={};const tally=(fs,t)=>{const m={};fs.forEach(f=>{const k=Poly.key(f);keyOf[k]=f;m[k]=(m[k]||0)+1;});return m;};
  const ma=tally(a.d),mb=tally(b.d);const D=[],ea=[],eb=[];
  for(const k of new Set([...Object.keys(ma),...Object.keys(mb)])){const x=ma[k]||0,y=mb[k]||0,m=Math.max(x,y);
   for(let i=0;i<m;i++)D.push(keyOf[k]);for(let i=x;i<m;i++)ea.push(keyOf[k]);for(let i=y;i<m;i++)eb.push(keyOf[k]);}
  const prod=fs=>fs.reduce((p,f)=>Poly.mul(p,f),Poly.c(1));
  const N=Poly.add(Poly.scale(prod([...a.n,...ea]),a.c),Poly.scale(prod([...b.n,...eb]),b.c));
  if(Poly.isZero(N))return RF.num(0);
  return RF.mk(1,[N],D);
 },
 sub(a,b){return RF.add(a,RF.neg(b));},
 eval(a,env){let v=a.c;for(const f of a.n)v*=Poly.eval(f,env);for(const f of a.d)v/=Poly.eval(f,env);return v;},
 vars(a){const s=new Set();[...a.n,...a.d].forEach(f=>Poly.vars(f).forEach(v=>s.add(v)));return s;},
 one(){return RF.num(1);}
};
/* numeric equivalence on random points */
function rfEquivalent(a,b,vars){
 const vs=[...new Set([...RF.vars(a),...RF.vars(b),...(vars||[])])];
 for(let t=0;t<7;t++){const env={};vs.forEach((v,i)=>env[v]=0.37+((Math.sin((t+1)*(i+3)*12.9898)*43758.5453)%1+1)%1*1.9);
  let x,y;try{x=RF.eval(a,env);y=RF.eval(b,env);}catch(e){return false;}
  if(!isFinite(x)||!isFinite(y))continue;if(Math.abs(x-y)>1e-7*Math.max(1,Math.abs(x),Math.abs(y)))return {env,x,y};}
 return true;
}
/* ---------- LaTeX / text printing ---------- */
const GREEK={'α':'\\alpha','β':'\\beta','γ':'\\gamma','δ':'\\delta','ζ':'\\zeta','ω':'\\omega','τ':'\\tau','κ':'\\kappa','λ':'\\lambda','μ':'\\mu'};
function varSplit(v){const m=v.match(/^(.)(.*)$/u);return [m[1],m[2]||''];}
function varLatex(v){const [b,s]=varSplit(v);const B=GREEK[b]||b;return s?`${B}_{${s}}`:B;}
function varText(v){return v;}
function varOrder(a,b){return a<b?-1:a>b?1:0;}
function fmtNum(x){if(Math.abs(x-Math.round(x))<1e-9)return String(Math.round(x));const s=+x.toPrecision(6);return String(s);}
function ratApprox(x){ // small-denominator fraction if exact enough
 for(let q=1;q<=1000;q++){const p=Math.round(x*q);if(Math.abs(p/q-x)<1e-9*Math.max(1,Math.abs(x)))return [p,q];}return null;}
function monoOut(k,latex){const o=monoParse(k);return Object.keys(o).sort(varOrder).map(v=>{const b=latex?varLatex(v):varText(v);return o[v]>1?(latex?`${b}^{${o[v]}}`:`${b}^${o[v]}`):b;}).join(latex?'':'·');}
function polyOut(p,latex){
 const ks=Object.keys(p);if(!ks.length)return '0';
 const vs=Poly.vars(p);const single=vs.size===1;
 ks.sort((a,b)=>single?(monoDeg(b)-monoDeg(a)):(monoDeg(a)-monoDeg(b)||(a<b?-1:a>b?1:0)));
 let s='';ks.forEach((k,i)=>{let c=p[k];const neg=c<0;c=Math.abs(c);const m=monoOut(k,latex);
  let t=m?(Math.abs(c-1)<1e-12?m:fmtNum(c)+(latex?'':'·')+m):fmtNum(c);
  s+=i===0?(neg?'-'+t:t):(neg?' - '+t:' + '+t);});
 return s;
}
function prodOut(fs,latex,wrapAlways){
 // group single-variable factors into one monomial
 const mono={},multi=[];
 for(const f of fs){const ks=Object.keys(f);if(ks.length===1&&f[ks[0]]===1){const o=monoParse(ks[0]);for(const v in o)mono[v]=(mono[v]||0)+o[v];}else multi.push(f);}
 const parts=[];const mk=monoKey(mono);if(mk)parts.push(monoOut(mk,latex));
 const many=multi.length+(mk?1:0)>1||wrapAlways;
 for(const f of multi){const t=polyOut(f,latex);parts.push(many?(latex?`\\left(${t}\\right)`:`(${t})`):t);}
 return parts.join(latex?'':'·');
}
function rfOut(a,latex){
 if(a.c===0)return '0';
 let c=a.c,neg=c<0;c=Math.abs(c);let cn=c,cd=1;const r=ratApprox(c);if(r){cn=r[0];cd=r[1];}
 let num=prodOut(a.n,latex,false),den=prodOut(a.d,latex,false);
 const cnS=Math.abs(cn-1)<1e-12?'':fmtNum(cn);
 if(cnS)num=num?(cnS+(latex?'':'·')+(a.n.length>1||(a.n.length===1&&Object.keys(a.n[0]).length>1)?(latex?`\\left(${num}\\right)`:`(${num})`):num)):cnS;
 if(!num)num='1';
 if(cd!==1)den=den?(fmtNum(cd)+(latex?'':'·')+(a.d.length===1&&Object.keys(a.d[0]).length>1?(latex?`\\left(${den}\\right)`:`(${den})`):den)):fmtNum(cd);
 const sg=neg?'-':'';
 if(!den)return sg+(neg&&a.n.length===1&&Object.keys(a.n[0]).length>1?(latex?`\\left(${num}\\right)`:`(${num})`):num);
 if(latex)return `${sg}\\dfrac{${num}}{${den}}`;
 const wrap=s=>/[+\- ·]/.test(s.replace(/^-/,''))?`(${s})`:s;
 return sg+wrap(num)+' / '+wrap(den);
}
const rfLatex=a=>rfOut(a,true),rfText=a=>rfOut(a,false);
/* ---------- expression parser → RF ---------- */
const ID_RE=/^[A-Za-zα-ωΑ-Ω](?:_?\{?(?:T?\d+|[a-z]+)\}?)?/u;
function tokenize(s){
 const t=[];let i=0;s=s.replace(/[·×]/g,'*').replace(/−/g,'-');
 while(i<s.length){const ch=s[i];
  if(/\s/.test(ch)){i++;continue;}
  const num=s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i);
  if(num){t.push({t:'n',v:parseFloat(num[0])});i+=num[0].length;continue;}
  const id=s.slice(i).match(ID_RE);
  if(id){t.push({t:'i',v:id[0].replace(/[_{}]/g,'')});i+=id[0].length;continue;}
  if('+-*/^()'.includes(ch)){t.push({t:ch});i++;continue;}
  throw new Error('bad char '+ch);
 }
 // implicit multiplication
 const o=[];for(let k=0;k<t.length;k++){const a=o[o.length-1],b=t[k];
  if(a&&(a.t==='n'||a.t==='i'||a.t===')')&&(b.t==='n'||b.t==='i'||b.t==='('))o.push({t:'*'});o.push(b);}
 return o;
}
function parseExpr(s){
 const T=tokenize(String(s));let p=0;const peek=()=>T[p],eat=x=>{if(!T[p]||T[p].t!==x)throw new Error('expected '+x);p++;};
 const expr=()=>{let v=term();while(peek()&&(peek().t==='+'||peek().t==='-')){const op=T[p++].t;const r=term();v=op==='+'?RF.add(v,r):RF.sub(v,r);}return v;};
 const term=()=>{let v=fac();while(peek()&&(peek().t==='*'||peek().t==='/')){const op=T[p++].t;const r=fac();v=op==='*'?RF.mul(v,r):RF.div(v,r);}return v;};
 const fac=()=>{let v=un();if(peek()&&peek().t==='^'){p++;let neg=false;if(peek()&&peek().t==='-'){neg=true;p++;}const e=T[p++];if(!e||e.t!=='n'||e.v!==Math.round(e.v))throw new Error('integer power only');
   let r=RF.one();for(let i=0;i<e.v;i++)r=RF.mul(r,v);v=neg?RF.div(RF.one(),r):r;}return v;};
 const un=()=>{if(peek()&&peek().t==='-'){p++;return RF.neg(un());}if(peek()&&peek().t==='+'){p++;return un();}return atom();};
 const atom=()=>{const x=T[p++];if(!x)throw new Error('unexpected end');
  if(x.t==='n')return RF.num(x.v);if(x.t==='i')return RF.sym(x.v);
  if(x.t==='('){const v=expr();eat(')');return v;}throw new Error('unexpected '+x.t);};
 if(!T.length)throw new Error('empty');
 const v=expr();if(p<T.length)throw new Error('unexpected '+T[p].t);return v;
}

/* ---------- block-diagram graph ----------
 node: {id,type:'R'|'C'|'G'|'S'|'P', name, expr, x,y, flip, seg:[{b,s,inv}], rf, rfx}
 edge: {id,from,to,port,sign}
*/
let _gid=1;const gid=p=>p+(_gid++).toString(36);
function clone(g){return JSON.parse(JSON.stringify(g));}
const outs=(g,id)=>g.edges.filter(e=>e.from===id);
const ins=(g,id)=>g.edges.filter(e=>e.to===id);
const nodeOf=(g,id)=>g.nodes.find(n=>n.id===id);
function delNode(g,id){g.nodes=g.nodes.filter(n=>n.id!==id);g.edges=g.edges.filter(e=>e.from!==id&&e.to!==id);}
function delEdge(g,e){g.edges=g.edges.filter(x=>x!==e&&x.id!==e.id);}
function segFromName(name){const [b,s]=varSplit(name||'G');return [{b,s}];}
function segLatex(seg){
 const one=x=>{const B=(GREEK[x.b]||x.b)+(x.s?`_{${x.s}}`:'');return x.inv?`\\frac{1}{${B}}`:B;};
 if(seg.length===1&&seg[0].neg)return '-'+one(seg[0]);return seg.map(one).join('');}
function segText(seg){return seg.map(x=>(x.inv?'1/':'')+x.b+(x.s||'')).join('·');}
function prepare(g0){ // attach rf/rfx to original blocks, validate expressions
 const g=clone(g0);const errs=[];
 for(const n of g.nodes)if(n.type==='G'){
  n.seg=n.seg&&n.seg.length?n.seg:segFromName(n.name);
  const sym=(n.name||'G').replace(/\s/g,'');
  try{n.rf=parseExpr(sym);}catch(e){n.rf=RF.sym('X'+n.id);errs.push({k:'badName',id:n.id,name:n.name});}
  if(n.expr&&String(n.expr).trim()){try{n.rfx=parseExpr(n.expr);}catch(e){n.rfx=n.rf;errs.push({k:'badExpr',id:n.id,name:n.name,expr:n.expr});}}else n.rfx=n.rf;
 }
 return {g,errs};
}
/* validation → list of {sev,k,ids} */
function validate(g){
 const out=[];const R=g.nodes.filter(n=>n.type==='R'),C=g.nodes.filter(n=>n.type==='C');
 if(R.length!==1)out.push({sev:'err',k:R.length?'manyR':'noR',ids:R.map(n=>n.id)});
 if(C.length!==1)out.push({sev:'err',k:C.length?'manyC':'noC',ids:C.map(n=>n.id)});
 for(const n of g.nodes){const i=ins(g,n.id),o=outs(g,n.id);
  if(n.type==='R'&&i.length)out.push({sev:'err',k:'intoR',ids:[n.id]});
  if(n.type==='G'){if(i.length===0)out.push({sev:'err',k:'blockNoIn',ids:[n.id]});else if(i.length>1)out.push({sev:'err',k:'blockManyIn',ids:[n.id]});if(!o.length)out.push({sev:'err',k:'blockNoOut',ids:[n.id]});}
  if(n.type==='S'){if(!i.length)out.push({sev:'err',k:'sumNoIn',ids:[n.id]});if(!o.length)out.push({sev:'err',k:'sumNoOut',ids:[n.id]});
   if(i.some(e=>e.sign!==1&&e.sign!==-1))out.push({sev:'err',k:'unsigned',ids:[n.id]});}
  if(n.type==='P'){if(i.length!==1)out.push({sev:'err',k:i.length?'pickManyIn':'pickNoIn',ids:[n.id]});if(!o.length)out.push({sev:'warn',k:'pickNoOut',ids:[n.id]});}
  if(n.type==='C'&&i.length!==1)out.push({sev:'err',k:i.length?'cManyIn':'cNoIn',ids:[n.id]});
 }
 if(R.length===1&&C.length===1){
  const seen=new Set([R[0].id]),q=[R[0].id];while(q.length){const u=q.shift();for(const e of outs(g,u))if(!seen.has(e.to)){seen.add(e.to);q.push(e.to);}}
  if(!seen.has(C[0].id))out.push({sev:'err',k:'open',ids:[R[0].id,C[0].id]});
  const dead=g.nodes.filter(n=>!seen.has(n.id)&&n.type!=='R');if(dead.length)out.push({sev:'warn',k:'unreached',ids:dead.map(n=>n.id)});
 }
 // cycles without any block = algebraic loop
 const loops=simpleCycles(g);
 for(const L of loops)if(!L.some(id=>nodeOf(g,id).type==='G')){out.push({sev:'err',k:'algLoop',ids:L});break;}
 for(const L of loops)if(!L.some(id=>nodeOf(g,id).type==='S')){out.push({sev:'err',k:'noSumLoop',ids:L});break;}
 return out;
}
function simpleCycles(g){
 const ids=g.nodes.map(n=>n.id),idx={};ids.forEach((id,i)=>idx[id]=i);const res=[];
 const adj={};ids.forEach(id=>adj[id]=outs(g,id).map(e=>e.to));
 for(let s=0;s<ids.length;s++){const start=ids[s];const path=[start],on=new Set([start]);
  const dfs=u=>{for(const v of adj[u]){if(v===start){res.push(path.slice());continue;}if(idx[v]<s||on.has(v))continue;path.push(v);on.add(v);dfs(v);path.pop();on.delete(v);}};
  dfs(start);if(res.length>200)break;}
 return res;
}
/* ---------- Mason's gain formula (independent check) ---------- */
function edgeGain(g,e,mode){const t=nodeOf(g,e.to);if(t.type==='G')return mode==='x'?t.rfx:t.rf;if(t.type==='S')return RF.num(e.sign);return RF.one();}
function mason(g,mode){
 const R=g.nodes.find(n=>n.type==='R'),C=g.nodes.find(n=>n.type==='C');
 const paths=[];const dfs=(u,vis,gain,nodes)=>{if(u===C.id){paths.push({gain,nodes:new Set(nodes)});return;}
  for(const e of outs(g,u)){if(vis.has(e.to))continue;vis.add(e.to);nodes.push(e.to);dfs(e.to,vis,RF.mul(gain,edgeGain(g,e,mode)),nodes);nodes.pop();vis.delete(e.to);}};
 dfs(R.id,new Set([R.id]),RF.one(),[R.id]);
 const loops=simpleCycles(g).map(L=>{let gain=RF.one();for(let i=0;i<L.length;i++){const a=L[i],b=L[(i+1)%L.length];const e=g.edges.find(x=>x.from===a&&x.to===b);gain=RF.mul(gain,edgeGain(g,e,mode));}return {gain,nodes:new Set(L),ids:L};});
 const touch=(A,B)=>{for(const x of A)if(B.has(x))return true;return false;};
 const delta=avoid=>{ // 1 - ΣL + Σ LiLj ...
  const cand=loops.filter(l=>!avoid||!touch(l.nodes,avoid));let D=RF.one();
  const rec=(start,used,prod,k)=>{for(let i=start;i<cand.length;i++){const l=cand[i];if(used.some(u=>touch(u.nodes,l.nodes)))continue;
    const p=RF.mul(prod,l.gain);D=k%2===1?RF.sub(D,p):RF.add(D,p);used.push(l);rec(i+1,used,p,k+1);used.pop();}};
  rec(0,[],RF.one(),1);return D;};
 const Dl=delta(null);let num=RF.num(0);const terms=[];
 for(const pth of paths){const dk=delta(pth.nodes);terms.push({P:pth.gain,D:dk});num=RF.add(num,RF.mul(pth.gain,dk));}
 return {T:RF.div(num,Dl),paths:terms,loops,Delta:Dl,num};
}
/* ---------- normalization ---------- */
function normalize(g){
 const g2=g;
 // C with outgoing edges → pickoff before C
 for(const n of g2.nodes.filter(n=>n.type==='C')){const o=outs(g2,n.id);if(!o.length)continue;const i=ins(g2,n.id)[0];if(!i)continue;
  const P={id:gid('p'),type:'P',x:n.x-40,y:n.y};g2.nodes.push(P);i.to=P.id;i.port='in';o.forEach(e=>e.from=P.id);g2.edges.push({id:gid('e'),from:P.id,to:n.id,port:'in',sign:1});}
 // nodes with >1 out (other than P) → pickoff
 for(const n of g2.nodes.slice()){if(n.type==='P')continue;const o=outs(g2,n.id);if(o.length<2)continue;
  const P={id:gid('p'),type:'P',x:n.x+(n.flip?-50:50),y:n.y};g2.nodes.push(P);o.forEach(e=>e.from=P.id);g2.edges.push({id:gid('e'),from:n.id,to:P.id,port:'in',sign:1});}
 // P → P chains
 let ch=true;while(ch){ch=false;for(const e of g2.edges){const a=nodeOf(g2,e.from),b=nodeOf(g2,e.to);if(a&&b&&a.type==='P'&&b.type==='P'){outs(g2,b.id).forEach(x=>x.from=a.id);delNode(g2,b.id);ch=true;break;}}}
 return g2;
}
function cleanup(g){ // remove identity pickoffs and single-plus sums
 let ch=true;while(ch){ch=false;
  for(const n of g.nodes){const i=ins(g,n.id),o=outs(g,n.id);
   if(n.type==='P'&&i.length===1&&o.length===1){o[0].from=i[0].from;delEdge(g,i[0]);delNode(g,n.id);ch=true;break;}
   if(n.type==='P'&&i.length===1&&o.length===0){delEdge(g,i[0]);delNode(g,n.id);ch=true;break;}
   if(n.type==='S'&&i.length===1&&i[0].sign===1&&o.length===1){o[0].from=i[0].from;delEdge(g,i[0]);delNode(g,n.id);ch=true;break;}
  }}
 return g;
}
/* ---------- naming ---------- */
function newT(ctx){ctx.t++;return {seg:[{b:'G',s:'T'+ctx.t}],name:'GT'+ctx.t};}
function compositeSeg(a,b){const s=[...a.seg,...b.seg];return s.length<=3?s:null;}
function lat(n){return n?segLatex(n.seg):'1';}
/* ---------- rules ---------- */
function findSeries(g){
 for(const e of g.edges){const A=nodeOf(g,e.from),B=nodeOf(g,e.to);
  if(A.type==='G'&&B.type==='G'&&outs(g,A.id).length===1&&ins(g,B.id).length===1)return {A,B,e};}
 return null;
}
function applySeries(g,m,ctx){
 const {A,B}=m;const seg=compositeSeg(A,B);const nm=seg?{seg,name:segText(seg)}:newT(ctx);
 const N={id:gid('g'),type:'G',name:nm.name,seg:nm.seg,x:Math.round((A.x+B.x)/2),y:A.flip===B.flip?Math.round((A.y+B.y)/2):A.y,flip:A.flip,rf:RF.mul(A.rf,B.rf),rfx:RF.mul(A.rfx,B.rfx)};
 g.nodes.push(N);ins(g,A.id).forEach(e=>e.to=N.id);outs(g,B.id).forEach(e=>e.from=N.id);delNode(g,A.id);delNode(g,B.id);cleanup(g);
 const named=!seg;
 return {rule:'series',hl:[A.id,B.id],add:N.id,
  eqLocal:`${lat(N)} = ${lat(A)}\\cdot ${lat(B)}`,
  eqFull:named?`${lat(N)} = ${rfLatex(N.rf)}`:null,node:N};
}
function branchesInto(g,S){
 return ins(g,S.id).map(e=>{const Y=nodeOf(g,e.from);
  if(Y.type==='G'&&ins(g,Y.id).length===1&&outs(g,Y.id).length===1)return {e,blk:Y,src:ins(g,Y.id)[0].from,inEdge:ins(g,Y.id)[0]};
  return {e,blk:null,src:Y.id};});
}
function findParallel(g){
 for(const S of g.nodes.filter(n=>n.type==='S')){const br=branchesInto(g,S);
  for(let i=0;i<br.length;i++)for(let j=i+1;j<br.length;j++){if(br[i].src!==br[j].src)continue;if(!br[i].blk&&!br[j].blk)continue;
   const X=nodeOf(g,br[i].src);if(X.type!=='P'&&outs(g,X.id).length<2)continue;
   return {S,a:br[i],b:br[j],X};}}
 return null;
}
function applyParallel(g,m,ctx){
 const {S,a,b,X}=m;const ga=a.blk?a.blk.rf:RF.one(),gb=b.blk?b.blk.rf:RF.one(),gxa=a.blk?a.blk.rfx:RF.one(),gxb=b.blk?b.blk.rfx:RF.one();
 const nm=newT(ctx);const main=a.blk&&(!b.blk||Math.abs(a.blk.y-X.y)<=Math.abs(b.blk.y-X.y))?a.blk:(b.blk||a.blk);
 const N={id:gid('g'),type:'G',name:nm.name,seg:nm.seg,x:main.x,y:main.y,flip:main.flip,
  rf:RF.add(RF.mul(RF.num(a.e.sign),ga),RF.mul(RF.num(b.e.sign),gb)),rfx:RF.add(RF.mul(RF.num(a.e.sign),gxa),RF.mul(RF.num(b.e.sign),gxb))};
 g.nodes.push(N);
 const port=a.e.port;const hl=[a.blk&&a.blk.id,b.blk&&b.blk.id].filter(Boolean);
 for(const br of [a,b]){delEdge(g,br.e);if(br.blk){delEdge(g,br.inEdge);delNode(g,br.blk.id);}else{/* direct edge from X already removed */}}
 g.edges.push({id:gid('e'),from:X.id,to:N.id,port:'in',sign:1},{id:gid('e'),from:N.id,to:S.id,port,sign:1});
 cleanup(g);
 const sg=x=>x===1?'+':'-';const la=a.blk?lat(a.blk):'1',lb=b.blk?lat(b.blk):'1';
 return {rule:'parallel',hl:[...hl,S.id],add:N.id,eqLocal:`${lat(N)} = ${a.e.sign<0?'-':''}${la} ${sg(b.e.sign)} ${lb}`,eqFull:`${lat(N)} = ${rfLatex(N.rf)}`,node:N};
}
function findLoops(g){
 const res=[];
 for(const S of g.nodes.filter(n=>n.type==='S')){const so=outs(g,S.id);if(so.length!==1)continue;
  let G=null,P=null;const t=nodeOf(g,so[0].to);
  if(t.type==='G'&&ins(g,t.id).length===1){G=t;const go=outs(g,G.id);if(go.length!==1)continue;const p=nodeOf(g,go[0].to);if(p.type!=='P')continue;P=p;}
  else if(t.type==='P')P=t;else continue;
  for(const fe of ins(g,S.id)){const Y=nodeOf(g,fe.from);let H=null;
   if(Y.id===P.id){}else if(Y.type==='G'&&ins(g,Y.id).length===1&&outs(g,Y.id).length===1&&ins(g,Y.id)[0].from===P.id)H=Y;else continue;
   res.push({S,G,P,H,fe,ext:ins(g,S.id).filter(e=>e!==fe)});}
 }
 return res;
}
function applyLoop(g,m,ctx){
 const {S,G,P,H,fe,ext}=m;const e0=ext[0];const sE=e0.sign,sF=fe.sign;
 const Gf=G?G.rf:RF.one(),Hf=H?H.rf:RF.one(),Gx=G?G.rfx:RF.one(),Hx=H?H.rfx:RF.one();
 const loopRF=(Gr,Hr)=>RF.mul(RF.num(sE),RF.div(Gr,RF.sub(RF.one(),RF.mul(RF.num(sF),RF.mul(Gr,Hr)))));
 const nm=newT(ctx);const base=G||S;
 const N={id:gid('g'),type:'G',name:nm.name,seg:nm.seg,x:G?G.x:Math.round((S.x+P.x)/2),y:base.y,flip:G?G.flip:false,rf:loopRF(Gf,Hf),rfx:loopRF(Gx,Hx)};
 g.nodes.push(N);
 const hl=[S.id,G&&G.id,H&&H.id].filter(Boolean);
 g.edges.push({id:gid('e'),from:e0.from,to:N.id,port:'in',sign:1},{id:gid('e'),from:N.id,to:P.id,port:'in',sign:1});
 delEdge(g,e0);delEdge(g,fe);
 if(H){delNode(g,H.id);}
 if(G)delNode(g,G.id);delNode(g,S.id);
 cleanup(g);
 const gl=G?lat(G):'1',hlx=H?lat(H):'1';const prod=(gl==='1'?'':gl)+(hlx==='1'?'':hlx)||'1';
 const den=`1 ${sF<0?'+':'-'} ${prod}`;
 return {rule:H?'feedback':'unity',hl,add:N.id,sE,sF,eqLocal:`${lat(N)} = ${sE<0?'-':''}\\dfrac{${gl}}{${den}}`,eqFull:`${lat(N)} = ${rfLatex(N.rf)}`,node:N};
}
function applySplit(g,m){
 const {S,fe}=m;const so=outs(g,S.id)[0];const T=nodeOf(g,so.to);
 const S2={id:gid('s'),type:'S',x:Math.round((S.x*0.4+T.x*0.6)),y:S.y};g.nodes.push(S2);
 so.from=S2.id;g.edges.push({id:gid('e'),from:S.id,to:S2.id,port:'W',sign:1});fe.to=S2.id;
 return {rule:'split',hl:[S.id],add:S2.id,eqLocal:`E = R ${fe.sign<0?'-':'+'} B_1 \\pm \\dots \\;\\Rightarrow\\; E = (R \\pm \\dots) ${fe.sign<0?'-':'+'} B_1`};
}
/* moves (only when stuck) */
function moveCandidates(g){
 const C=[];
 for(const P of g.nodes.filter(n=>n.type==='P')){const i=ins(g,P.id)[0];if(!i)continue;const A=nodeOf(g,i.from);
  if(A.type==='G'&&ins(g,A.id).length===1&&outs(g,A.id).length===1)for(const b of outs(g,P.id))C.push({k:'pickBack',P,G:A,b});
  for(const f of outs(g,P.id)){const B=nodeOf(g,f.to);if(B.type==='G'&&ins(g,B.id).length===1&&outs(g,B.id).length===1)for(const b of outs(g,P.id))if(b!==f)C.push({k:'pickFwd',P,G:B,b,f});}}
 for(const S of g.nodes.filter(n=>n.type==='S')){const so=outs(g,S.id);if(so.length!==1)continue;const B=nodeOf(g,so[0].to);
  if(B.type==='G'&&ins(g,B.id).length===1&&outs(g,B.id).length===1&&ins(g,S.id).length>=2)for(const main of ins(g,S.id))C.push({k:'sumFwd',S,G:B,main});
  for(const e of ins(g,S.id)){const A=nodeOf(g,e.from);if(A.type==='G'&&ins(g,A.id).length===1&&outs(g,A.id).length===1&&ins(g,S.id).length>=2)C.push({k:'sumBack',S,G:A,main:e});}}
 return C;
}
function copyBlock(g,G,inv,x,y,flip){
 const seg=G.seg.map(s=>({...s,inv:inv?!s.inv:s.inv}));
 const N={id:gid('g'),type:'G',name:segText(seg),seg,x,y,flip:flip,rf:inv?RF.div(RF.one(),G.rf):G.rf,rfx:inv?RF.div(RF.one(),G.rfx):G.rfx};g.nodes.push(N);return N;}
function applyMove(g0,m){
 const g=g0;let info;
 if(m.k==='pickBack'){ // P after G → branch b leaves before G, through a copy of G
  const P=nodeOf(g,m.P.id),G=nodeOf(g,m.G.id),b=g.edges.find(e=>e.id===m.b.id);const gi=ins(g,G.id)[0];
  const P2={id:gid('p'),type:'P',x:G.x-(G.flip?-60:60),y:G.y};g.nodes.push(P2);
  gi.to=P2.id;g.edges.push({id:gid('e'),from:P2.id,to:G.id,port:'in',sign:1});
  const T=nodeOf(g,b.to);const Gc=copyBlock(g,G,false,Math.round((P2.x+T.x)/2),T.y===P.y?T.y+60:Math.round((T.y+P2.y)/2+30),true);
  b.from=Gc.id;g.edges.push({id:gid('e'),from:P2.id,to:Gc.id,port:'in',sign:1});
  info={rule:'pickBack',hl:[P.id,G.id],add:Gc.id,eqLocal:`B = ${lat(G)}\\,X \\;\\Rightarrow\\; \\text{branch} = ${lat(G)}\\cdot X`};
 }else if(m.k==='pickFwd'){ // P before G → branch b leaves after G, through 1/G
  const P=nodeOf(g,m.P.id),G=nodeOf(g,m.G.id),b=g.edges.find(e=>e.id===m.b.id);
  const go=outs(g,G.id)[0];const P2={id:gid('p'),type:'P',x:G.x+(G.flip?-60:60),y:G.y};g.nodes.push(P2);
  go.from=P2.id;g.edges.push({id:gid('e'),from:G.id,to:P2.id,port:'in',sign:1});
  const T=nodeOf(g,b.to);const Gc=copyBlock(g,G,true,Math.round((P2.x+T.x)/2),Math.round((T.y+P2.y)/2)+30,true);
  b.from=Gc.id;g.edges.push({id:gid('e'),from:P2.id,to:Gc.id,port:'in',sign:1});
  info={rule:'pickFwd',hl:[P.id,G.id],add:Gc.id,eqLocal:`X = \\dfrac{1}{${lat(G)}}\\cdot(${lat(G)}X)`};
 }else if(m.k==='sumFwd'){ // S before G → move after G; non-main inputs get copy of G
  const S=nodeOf(g,m.S.id),G=nodeOf(g,m.G.id);const so=outs(g,S.id)[0];const go=outs(g,G.id)[0];
  const others=ins(g,S.id).filter(e=>e.id!==m.main.id);const main=g.edges.find(e=>e.id===m.main.id);
  // main input feeds G directly (sign kept by a sum if negative)
  const S2={id:gid('s'),type:'S',x:G.x+(G.flip?-60:60),y:G.y};g.nodes.push(S2);
  go.from=S2.id;g.edges.push({id:gid('e'),from:G.id,to:S2.id,port:'W',sign:main.sign});
  main.to=G.id;main.port='in';main.sign=1;delEdge(g,so);
  let k=0;for(const e of others){const src=nodeOf(g,e.from);const Gc=copyBlock(g,G,false,Math.round((src.x+S2.x)/2),S2.y+(e.port==='N'?-70:70)+(k++)*10,false);
   g.edges.push({id:gid('e'),from:e.from,to:Gc.id,port:'in',sign:1},{id:gid('e'),from:Gc.id,to:S2.id,port:e.port,sign:e.sign});delEdge(g,e);}
  delNode(g,S.id);
  info={rule:'sumFwd',hl:[S.id,G.id],add:S2.id,eqLocal:`${lat(G)}(X \\pm Y) = ${lat(G)}X \\pm ${lat(G)}Y`};
 }else if(m.k==='sumBack'){ // G before S → move S before G; other inputs get 1/G
  const S=nodeOf(g,m.S.id),G=nodeOf(g,m.G.id);const main=g.edges.find(e=>e.id===m.main.id);const so=outs(g,S.id)[0];
  const others=ins(g,S.id).filter(e=>e.id!==main.id);const gi=ins(g,G.id)[0];
  const S2={id:gid('s'),type:'S',x:G.x-(G.flip?-60:60),y:G.y};g.nodes.push(S2);
  gi.to=S2.id;gi.port='W';gi.sign=main.sign;
  g.edges.push({id:gid('e'),from:S2.id,to:G.id,port:'in',sign:1});
  so.from=G.id;delEdge(g,main);
  let k=0;for(const e of others){const src=nodeOf(g,e.from);const Gc=copyBlock(g,G,true,Math.round((src.x+S2.x)/2),S2.y+(e.port==='N'?-70:70)+(k++)*10,false);
   g.edges.push({id:gid('e'),from:e.from,to:Gc.id,port:'in',sign:1},{id:gid('e'),from:Gc.id,to:S2.id,port:e.port,sign:e.sign});delEdge(g,e);}
  delNode(g,S.id);
  info={rule:'sumBack',hl:[S.id,G.id],add:S2.id,eqLocal:`${lat(G)}X \\pm Y = ${lat(G)}\\left(X \\pm \\dfrac{1}{${lat(G)}}Y\\right)`};
 }
 cleanup(g);normalize(g);return info;
}
function primaryStep(g,ctx,dry){
 let m;
 if((m=findSeries(g)))return dry?true:applySeries(g,m,ctx);
 if((m=findParallel(g)))return dry?true:applyParallel(g,m,ctx);
 const L=findLoops(g);
 const ready=L.find(l=>l.ext.length===1);if(ready)return dry?true:applyLoop(g,ready,ctx);
 const sp=L.find(l=>l.ext.length>=2);if(sp)return dry?true:applySplit(g,sp);
 return null;
}
function greedy(g,ctx){let n=0;while(primaryStep(g,ctx,false)&&n<80)n++;return g;}
function isDone(g){const R=g.nodes.find(n=>n.type==='R'),C=g.nodes.find(n=>n.type==='C');if(!R||!C)return false;
 const o=outs(g,R.id);if(o.length!==1)return false;if(o[0].to===C.id)return g.nodes.length===2;const B=nodeOf(g,o[0].to);
 return B.type==='G'&&outs(g,B.id).length===1&&outs(g,B.id)[0].to===C.id&&g.nodes.length===3;}
/* full reduction: returns {steps:[{...info, g}], final, ok} */
function reduce(g0in){
 const ctx={t:0};let g=clone(g0in);normalize(g);cleanup(g);
 const steps=[];let guard=0;
 while(!isDone(g)&&guard++<60){
  const prev=clone(g);let info=primaryStep(g,ctx,false);
  if(!info){ // try a move whose greedy follow-up shrinks the diagram most
   let best=null;const n0=g.nodes.length;
   for(const m of moveCandidates(g)){const t=clone(g);const c2={t:ctx.t};
    try{const mm=remap(t,m);applyMove(t,mm);greedy(t,c2);}catch(e){continue;}
    const sc=t.nodes.length+(isDone(t)?-100:0);if(sc<n0&&(!best||sc<best.sc))best={sc,m};}
   if(!best)break;
   info=applyMove(g,remap(g,best.m));
  }
  steps.push({...info,before:prev,g:clone(g)});
 }
 const done=isDone(g);let final=null,finalx=null;
 if(done){const R=g.nodes.find(n=>n.type==='R');const B=nodeOf(g,outs(g,R.id)[0].to);final=B.type==='G'?B.rf:RF.one();finalx=B.type==='G'?B.rfx:RF.one();}
 return {steps,done,final,finalx,g};
}
function remap(g,m){ // move objects reference nodes/edges by id
 const r={k:m.k};for(const key of ['P','G','S'])if(m[key])r[key]=nodeOf(g,m[key].id);
 for(const key of ['b','f','main'])if(m[key])r[key]=g.edges.find(e=>e.id===m[key].id);return r;}

if(typeof module!=='undefined')module.exports={Poly,RF,parseExpr,rfLatex,rfText,rfEquivalent,prepare,validate,reduce,mason,normalize,clone,simpleCycles,segLatex,segText,varLatex};
/* ===================== end engine ===================== */
