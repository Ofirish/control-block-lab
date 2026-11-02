/* ===================== Control Block Lab — UI ===================== */
let lang='he';try{lang=localStorage.getItem('cbl_lang')||'he';}catch(e){}
const L=(he,en)=>lang==='he'?he:en;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const svg=$('cv'),gView=$('view'),gDg=$('dg'),gOv=$('ov');
let doc=null,meta={};          // editable diagram + preserved link metadata
let mode='edit';               // 'edit' | 'steps'
let RED=null,cur=0;            // reduction result + current step index (0 = start, N+1 = final)
let sel=null,wireMode=false,wireFrom=null,hoverW=null;
let view={x:40,y:40,s:1},tab='steps',hist=[],redoS=[];
let anim=null,playing=false,speed=1,exprMode=false;
let uidc=1;const nid=p=>p+Date.now().toString(36).slice(-4)+(uidc++);
const NAMES={R:['כניסה R','Input R'],C:['יציאה C','Output C'],G:['בלוק G','Block G'],H:['בלוק משוב H','Feedback H'],S:['מחבר Σ','Summing Σ'],P:['נקודת הסתעפות','Pick-off point']};

/* ---------- KaTeX with plain-text fallback ---------- */
function tex2text(s){
 const grab=(str,i)=>{let d=0,j=i;for(;j<str.length;j++){if(str[j]==='{')d++;else if(str[j]==='}'){d--;if(d===0)return [str.slice(i+1,j),j+1];}}return [str.slice(i+1),str.length];};
 let o='',i=0;
 while(i<s.length){
  if(s.startsWith('\\dfrac',i)||s.startsWith('\\frac',i)){i+=s.startsWith('\\dfrac',i)?6:5;const [a,j]=grab(s,i);const [b,k]=grab(s,j);o+='('+tex2text(a)+')/('+tex2text(b)+')';i=k;continue;}
  if(s.startsWith('\\text{',i)){const [a,j]=grab(s,i+5);o+=a;i=j;continue;}
  if(s[i]==='_'&&s[i+1]==='{'){const [a,j]=grab(s,i+1);o+=tex2text(a);i=j;continue;}
  if(s[i]==='^'&&s[i+1]==='{'){const [a,j]=grab(s,i+1);o+='^'+tex2text(a);i=j;continue;}
  o+=s[i];i++;
 }
 return o.replace(/\\left|\\right/g,'').replace(/\\cdot/g,'·').replace(/\\Rightarrow/g,'⇒').replace(/\\pm/g,'±').replace(/\\dots/g,'…')
  .replace(/\\beta/g,'β').replace(/\\alpha/g,'α').replace(/\\tau/g,'τ').replace(/\\omega/g,'ω').replace(/\\[;,!]/g,' ').replace(/\\quad/g,'  ')
  .replace(/\\begin\{aligned\}|\\end\{aligned\}/g,'').replace(/\\\\/g,'\n').replace(/&/g,'').replace(/[{}]/g,'');
}
function texHTML(latex){
 if(window.katex){try{return `<div class="eq">${katex.renderToString(latex,{displayMode:true,throwOnError:false})}</div>`;}catch(e){}}
 return `<div class="eq txt">${esc(tex2text(latex))}</div>`;
}

/* ---------- geometry ---------- */
function blkW(n){const seg=n.seg&&n.seg.length?n.seg:segFromName(n.name);let w=0;for(const s of seg)w+=10+(s.s?s.s.length*8:0)+(s.inv?16:0);return Math.max(58,w+26);}
function portsOf(n){
 const f=n.flip?-1:1;
 switch(n.type){
  case 'R':return {out:{x:n.x+16,y:n.y,nx:1,ny:0},ins:{}};
  case 'C':return {out:null,ins:{in:{x:n.x-16,y:n.y,nx:-1,ny:0}}};
  case 'G':{const w=blkW(n)/2;return {out:{x:n.x+f*w,y:n.y,nx:f,ny:0},ins:{in:{x:n.x-f*w,y:n.y,nx:-f,ny:0}}};}
  case 'S':return {out:{x:n.x+f*15,y:n.y,nx:f,ny:0},ins:{W:{x:n.x-f*15,y:n.y,nx:-f,ny:0},N:{x:n.x,y:n.y-15,nx:0,ny:-1},S:{x:n.x,y:n.y+15,nx:0,ny:1}}};
  case 'P':return {out:{x:n.x,y:n.y,nx:0,ny:0},ins:{in:{x:n.x,y:n.y,nx:0,ny:0}}};
 }
}
function dirToward(a,b){const dx=b.x-a.x,dy=b.y-a.y;return Math.abs(dx)>=Math.abs(dy)?[Math.sign(dx)||1,0]:[0,Math.sign(dy)||1];}
function route(g,e){
 const A=nodeOf(g,e.from),B=nodeOf(g,e.to);if(!A||!B)return null;
 const pa=portsOf(A),pb=portsOf(B);if(!pa.out)return null;
 const a={...pa.out},b={...(pb.ins[e.port]||pb.ins.in||pb.ins.W)};
 if(A.type==='P'){ // leave a pick-off vertically toward feedback blocks above/below
  if(Math.abs(b.y-a.y)>20&&b.nx!==0)[a.nx,a.ny]=[0,Math.sign(b.y-a.y)];else [a.nx,a.ny]=dirToward(a,b);}
 if(B.type==='P'){const d=dirToward(b,a);[b.nx,b.ny]=d;}
 const P=[[a.x,a.y]];const L=14;
 const ah=a.nx!==0,bh=b.nx!==0;
 if(ah&&bh){
  if((b.x-a.x)*a.nx>=8&&a.nx===-b.nx){const mx=Math.round((a.x+b.x)/2);P.push([mx,a.y],[mx,b.y]);}
  else{const a1=a.x+a.nx*L,b1=b.x+b.nx*L;const ly=Math.abs(a.y-b.y)>36?Math.round((a.y+b.y)/2):Math.max(a.y,b.y)+56;P.push([a1,a.y],[a1,ly],[b1,ly],[b1,b.y]);}
 }else if(ah&&!bh){
  if((b.x-a.x)*a.nx>0&&(a.y-b.y)*b.ny>0)P.push([b.x,a.y]);
  else{const a1=a.x+a.nx*L,b1=b.y+b.ny*L;P.push([a1,a.y],[a1,b1],[b.x,b1]);}
 }else if(!ah&&bh){
  if((a.x-b.x)*b.nx>0&&(b.y-a.y)*a.ny>0)P.push([a.x,b.y]);
  else{const a1=a.y+a.ny*L,b1=b.x+b.nx*L;P.push([a.x,a1],[b1,a1],[b1,b.y]);}
 }else{
  if(a.x===b.x||(b.y-a.y)*a.ny<=0){const a1=a.y+a.ny*L,b1=b.y+b.ny*L;const mx=Math.round((a.x+b.x)/2);P.push([a.x,a1],[mx,a1],[mx,b1],[b.x,b1]);}
  else P.push([a.x,Math.round((a.y+b.y)/2)],[b.x,Math.round((a.y+b.y)/2)]);
 }
 P.push([b.x,b.y]);
 return {pts:P.filter((q,i)=>i===0||q[0]!==P[i-1][0]||q[1]!==P[i-1][1]),b,port:e.port};
}

/* ---------- drawing ---------- */
function segSVG(seg,x,y){
 let h=`<text class="nm" x="${x}" y="${y+5}" text-anchor="middle">`;
 seg.forEach(s=>{if(s.inv)h+=`<tspan>1/</tspan>`;h+=`<tspan>${esc(s.b)}</tspan>`;if(s.s)h+=`<tspan dy="4" font-size="10.5">${esc(s.s)}</tspan><tspan dy="-4"> </tspan>`;});
 return h+'</text>';
}
function nodeSVG(n,cls,exp){
 const c=`nd ${cls||''}`;let h='';
 if(n.type==='G'){const w=blkW(n),seg=n.seg&&n.seg.length?n.seg:segFromName(n.name);
  h=`<g class="${c} blk${n.flip?' fbk':''}" data-node="${n.id}"><rect class="b" x="${n.x-w/2}" y="${n.y-20}" width="${w}" height="40" rx="6"/>${segSVG(seg,n.x,n.y)}`;
  if(n.expr&&String(n.expr).trim()&&n.expr!==n.name)h+=`<text class="ex" x="${n.x}" y="${n.y+34}" text-anchor="middle">${esc(String(n.expr).slice(0,22))}</text>`;
  h+='</g>';}
 else if(n.type==='S')h=`<g class="${c} sum" data-node="${n.id}"><circle cx="${n.x}" cy="${n.y}" r="15"/><path d="M${n.x-10.6} ${n.y-10.6}L${n.x+10.6} ${n.y+10.6}M${n.x+10.6} ${n.y-10.6}L${n.x-10.6} ${n.y+10.6}"/></g>`;
 else if(n.type==='P')h=`<g class="${c}" data-node="${n.id}"><circle class="pk" cx="${n.x}" cy="${n.y}" r="4.5"/>${exp?'':`<circle class="hit" cx="${n.x}" cy="${n.y}" r="12"/>`}</g>`;
 else h=`<g class="${c} io" data-node="${n.id}"><circle cx="${n.x}" cy="${n.y}" r="16"/><text x="${n.x}" y="${n.y+4.5}" text-anchor="middle">${n.type==='R'?'R':'C'}</text></g>`;
 return h;
}
function diagramSVG(g,o){
 o=o||{};let h='';const hl=new Set(o.hl||[]),bad=new Set(o.bad||[]);
 for(const e of g.edges){const r=route(g,e);if(!r)continue;const B=nodeOf(g,e.to),A=nodeOf(g,e.from);
  const fb=(A.flip||B.flip||(r.pts[r.pts.length-1][0]<r.pts[0][0]-4));
  const isSel=!o.exp&&sel&&sel.kind==='edge'&&sel.id===e.id;const hw=hl.has(e.from)&&hl.has(e.to)||(hl.has(e.to)&&A.type==='P')||(hl.has(e.from)&&B.type==='P');
  const cls=`wire${fb?' fb':''}${isSel?' sel':''}${hw?(o.fade?' fadew':' hlw'):''}`;
  const mk=B.type==='P'?'':`marker-end="url(#${hw&&!o.fade?'arh':fb?'arf':'ar'})"`;
  const pts=r.pts.map(p=>p.join(',')).join(' ');
  h+=`<polyline class="${cls}" points="${pts}" ${mk}/>`;
  if(!o.exp)h+=`<polyline class="whit" data-edge="${e.id}" points="${pts}"/>`;
  if(B.type==='S'){const b=r.b;const ox=b.ny?10:(b.nx<0?-11:11),oy=b.ny?(b.ny<0?-6:15):-7;
   h+=`<text class="sg ${e.sign<0?'m':'p'}" x="${b.x+ox}" y="${b.y+oy}" text-anchor="middle">${e.sign<0?'−':'+'}</text>`;}
 }
 for(const n of g.nodes){let cls='';
  if(hl.has(n.id))cls=o.fade?'fade':'hl';if(o.pop&&o.pop===n.id)cls='pop';if(o.newn&&o.newn===n.id)cls+=' newn';
  if(bad.has(n.id))cls+=' bad';if(!o.exp&&sel&&sel.kind==='node'&&sel.id===n.id)cls+=' nsel';
  h+=nodeSVG(n,cls,o.exp);}
 if(!o.exp&&mode==='edit'&&(wireMode||wireFrom))for(const n of g.nodes){const p=portsOf(n);
  if(p.out&&!wireFrom)h+=`<circle class="port on" cx="${p.out.x}" cy="${p.out.y}" r="6"/>`;}
 return h;
}
function curGraph(){
 if(mode!=='steps'||!RED)return doc;
 if(cur===0)return RED.start;const N=RED.steps.length;
 return cur>N?RED.steps[N-1].g:RED.steps[cur-1].g;
}
function render(opts){
 const g=curGraph();if(!g){gDg.innerHTML='';return;}
 let o=opts||{};
 if(!opts&&mode==='steps'&&cur>0&&cur<=RED.steps.length)o={newn:RED.steps[cur-1].add};
 if(!opts&&mode==='edit'&&VAL)o={bad:VAL.filter(v=>v.sev==='err').flatMap(v=>v.ids||[])};
 gDg.innerHTML=diagramSVG(g,o);
 renderOverlay();applyView();updateToolbar();
}
function renderOverlay(){
 let h='';
 if(wireFrom&&hoverW){const n=nodeOf(doc,wireFrom);const p=portsOf(n).out;if(p)h+=`<line class="prev" x1="${p.x}" y1="${p.y}" x2="${hoverW[0]}" y2="${hoverW[1]}"/>`;}
 gOv.innerHTML=h;
}
function applyView(){gView.setAttribute('transform',`translate(${view.x},${view.y}) scale(${view.s})`);}

/* ---------- validation / reduction ---------- */
let VAL=null;
function prepared(){return prepare(doc);}
function revalidate(){const pr=prepared();VAL=[...pr.errs.map(e=>({sev:'err',k:e.k,ids:[e.id],extra:e})),...validate(pr.g)];}
const VMSG={
 noR:[['אין כניסה R','No input R'],['כל דיאגרמה צריכה נקודת התחלה אחת — האות R(s) שנכנס למערכת.','Every diagram needs one starting point — the input signal R(s).'],['גרור "כניסה R" מהסרגל וחבר אותה לתחילת המסלול.','Drag "Input R" from the palette and wire it to the start of the path.']],
 manyR:[['יותר מכניסה אחת','More than one input'],['פונקציית תמסורת C/R מוגדרת לכניסה אחת. עם שתי כניסות יש שתי תמסורות שונות (סופרפוזיציה).','A transfer function C/R is defined for one input. Two inputs means two separate transfer functions (superposition).'],['השאר כניסה אחת. אם צריך הפרעה D — חשב כל כניסה בנפרד.','Keep a single input. For a disturbance D, solve each input separately.']],
 noC:[['אין יציאה C','No output C'],['צריך לדעת איפה מודדים את התגובה C(s).','The output point C(s) must be marked.'],['גרור "יציאה C" וחבר אליה את סוף המסלול הקדמי.','Drag "Output C" and connect the end of the forward path to it.']],
 manyC:[['יותר מיציאה אחת','More than one output'],['יש להגדיר יציאה אחת לתמסורת.','Define a single output for the transfer function.'],['מחק יציאה מיותרת.','Delete the extra output.']],
 intoR:[['חוט נכנס לכניסה R','A wire enters R'],['R הוא המקור — אות לא יכול להיכנס אליו.','R is the source — nothing can flow into it.'],['הפנה את החוט למחבר Σ אחרי R.','Route the wire into a summing junction after R.']],
 blockNoIn:[['לבלוק אין כניסה','Block has no input'],['בלוק מכפיל את האות שנכנס אליו. בלי כניסה אין מה להכפיל.','A block multiplies its input signal. With no input there is nothing to multiply.'],['חבר חוט לצד הכניסה של הבלוק.','Wire something into the block\'s input side.']],
 blockManyIn:[['לבלוק יש כמה כניסות','Block has several inputs'],['בלוק G מקבל אות אחד: Y = G·X. כששני חוטים נכנסים לבלוק לא ברור אם מחברים או מחסרים אותם.','A block takes one signal: Y = G·X. With two wires in, it is unclear whether to add or subtract them.'],['שים מחבר Σ לפני הבלוק וקבע לכל כניסה סימן + או −.','Put a summing junction before the block and give each input a + or − sign.']],
 blockNoOut:[['יציאת הבלוק לא מחוברת','Block output not connected'],['האות שיוצא מהבלוק לא מגיע לשום מקום, אז הבלוק לא משפיע על C.','The block\'s output goes nowhere, so it cannot affect C.'],['חבר את היציאה שלו להמשך המסלול או מחק אותו.','Connect its output onward or delete it.']],
 sumNoIn:[['למחבר אין כניסות','Sum has no inputs'],['מחבר מחשב סכום של אותות — חייב לפחות כניסה אחת.','A summing junction adds signals — it needs at least one input.'],['חבר אליו את הכניסה ואת אות המשוב.','Wire the input and the feedback into it.']],
 sumNoOut:[['למחבר אין יציאה','Sum has no output'],['תוצאת החיבור לא ממשיכה הלאה.','The sum result is not used.'],['חבר את היציאה שלו לבלוק הבא.','Connect its output to the next block.']],
 unsigned:[['כניסה למחבר בלי סימן','Unsigned sum input'],['כל כניסה למחבר חייבת סימן: + (מוסיף) או − (מחסר). במשוב שלילי האות החוזר מסומן −.','Every sum input needs a sign: + or −. In negative feedback the returning signal is −.'],['בחר את החוט ולחץ על כפתור הסימן.','Select the wire and toggle its sign.']],
 pickNoIn:[['נקודת הסתעפות בלי כניסה','Pick-off with no input'],['נקודת הסתעפות מעתיקה אות קיים — צריך אות שייכנס אליה.','A pick-off copies an existing signal — it needs one coming in.'],['חבר אליה את יציאת הבלוק שממנו רוצים לקחת משוב.','Feed it from the block output you want to sample.']],
 pickManyIn:[['נקודת הסתעפות עם כמה כניסות','Pick-off with several inputs'],['בנקודת הסתעפות אותות לא מתחברים — רק מתפצלים. חיבור אותות נעשה רק במחבר Σ.','Signals never add at a pick-off — they only split. Adding happens only at Σ.'],['החלף אותה במחבר Σ.','Replace it with a summing junction.']],
 pickNoOut:[['נקודת הסתעפות שלא מובילה לשום מקום','Pick-off goes nowhere'],['אין ענף שיוצא ממנה.','No branch leaves it.'],['מחק אותה או חבר ממנה ענף משוב.','Delete it or draw a feedback branch from it.']],
 cNoIn:[['שום דבר לא מגיע ליציאה C','Nothing reaches C'],['C צריך לקבל את אות היציאה של המסלול הקדמי.','C must receive the forward path\'s output.'],['חבר את הבלוק האחרון (או נקודת ההסתעפות שאחריו) ל-C.','Connect the last block (or the pick-off after it) to C.']],
 cManyIn:[['כמה חוטים נכנסים ל-C','Several wires enter C'],['C הוא נקודת מדידה ולא מחבר.','C is a measuring point, not a sum.'],['חבר את האותות במחבר לפני C.','Add the signals in a Σ before C.']],
 open:[['מסלול פתוח: R לא מגיע ל-C','Open path: R does not reach C'],['כדי שתהיה תמסורת C/R חייב להיות מסלול רציף של חוטים מ-R ל-C בכיוון החיצים.','For a transfer function C/R there must be an unbroken arrow path from R to C.'],['חפש חוט חסר או חוט הפוך במסלול הקדמי.','Look for a missing or reversed wire on the forward path.']],
 unreached:[['רכיבים שלא מחוברים למסלול','Parts not on any path'],['האות מ-R לא מגיע אליהם, אז הם לא משפיעים על התשובה.','R never reaches them, so they do not affect the answer.'],['חבר אותם או מחק אותם.','Connect or delete them.']],
 algLoop:[['לולאה בלי שום בלוק','Loop with no block'],['אות שחוזר למחבר בלי לעבור בבלוק יוצר משוואה כמו E = R − E: זו "לולאה אלגברית" ולא לולאת משוב רגילה.','A signal returning to a sum without any block gives E = R − E: an algebraic loop, not a normal feedback loop.'],['שים בלוק (לפחות H = 1 עם שם) על ענף המשוב, או בדוק את הכיוונים.','Put a block (even H = 1) on the feedback branch, or check the arrow directions.']],
 noSumLoop:[['לולאה שלא עוברת במחבר','Loop without a sum'],['משוב חייב להיכנס למחבר Σ שם הוא מתערבב עם הכניסה. לולאה בלי מחבר היא לא משוב תקין.','Feedback must enter a summing junction where it mixes with the input. A loop without a sum is not proper feedback.'],['הכנס את ענף המשוב למחבר Σ.','Route the feedback branch into a Σ.']],
 badName:[['שם בלוק לא תקין','Invalid block name'],['השם משמש כמשתנה בחישוב (למשל G1, H2, K, A).','The name is used as an algebra symbol (e.g. G1, H2, K, A).'],['השתמש באות ואחריה ספרות או אותיות קטנות.','Use a letter followed by digits or lowercase letters.']],
 badExpr:[['ביטוי לא תקין','Invalid expression'],['הביטוי צריך להיות פונקציה רציונלית: מספרים, משתנים, + − * / ^ וסוגריים.','The expression must be rational: numbers, symbols, + − * / ^ and parentheses.'],['למשל: 10/(s+1) או K/(s*(s+2)).','e.g. 10/(s+1) or K/(s*(s+2)).']],
};
function vmsg(k,i){const m=VMSG[k];return m?L(m[i][0],m[i][1]):k;}

/* rule explanations */
function ruleInfo(st){
 const n=st.node,lt=x=>x;
 switch(st.rule){
  case 'series':return {t:L('בלוקים בטור','Blocks in series'),why:L('יציאת הבלוק הראשון היא הכניסה היחידה של הבלוק השני, ושום ענף לא יוצא ביניהם. האות עובר דרך שניהם ברצף: Y = G_b·(G_a·X). לכן מחליפים אותם בבלוק אחד שהתמסורת שלו היא המכפלה.','The first block\'s output is the only input of the second, with nothing branching off between them. The signal passes through both in turn: Y = G_b·(G_a·X), so they become one block equal to the product.')};
  case 'parallel':return {t:L('בלוקים במקביל','Blocks in parallel'),why:L('אותו אות X מתפצל לשני ענפים, והם נפגשים שוב במחבר. היציאה היא סכום (או הפרש) של שני הענפים: Y = G_a·X ± G_b·X = (G_a ± G_b)·X. הסימן בא מהסימן של כל ענף במחבר.','One signal X splits into two branches that meet again at a sum. The output is Y = G_a·X ± G_b·X = (G_a ± G_b)·X; each sign comes from that branch\'s sign at the sum.')};
  case 'feedback':case 'unity':return {t:st.rule==='unity'?L('לולאת משוב יחידה (H = 1)','Unity feedback loop (H = 1)'):L('לולאת משוב','Feedback loop'),
   why:L(`מחבר אחד, בלוק אחד במסלול הקדמי ו${st.rule==='unity'?'חוט':'בלוק'} אחד שמחזיר את היציאה למחבר. זו הלולאה הפנימית ביותר — אין בתוכה שום הסתעפות אחרת — ולכן אפשר "לסגור" אותה לבלוק אחד. ${st.sF<0?'במשוב שלילי המכנה הוא 1 + (הגבר הלולאה).':'במשוב חיובי המכנה הוא 1 − (הגבר הלולאה).'}`,
    `One sum, one forward block and one ${st.rule==='unity'?'wire':'block'} returning the output to the sum. It is the innermost loop — nothing else branches inside it — so it can be closed into a single block. ${st.sF<0?'With negative feedback the denominator is 1 + (loop gain).':'With positive feedback the denominator is 1 − (loop gain).'}`),deriv:true};
  case 'split':return {t:L('פיצול מחבר','Splitting a summing junction'),why:L('למחבר יש יותר משתי כניסות, אבל רק אחת מהן שייכת ללולאה הפנימית. חיבור הוא חילופי וקיבוצי — (a + b) − c זה אותו דבר כמו a + b − c — ולכן מפצלים אותו לשני מחברים ברצף: הלולאה הפנימית מקבלת מחבר משלה וניתן לסגור אותה. האות לא משתנה בכלל.','The sum has more than two inputs, but only one belongs to the innermost loop. Addition is commutative and associative — (a + b) − c equals a + b − c — so we split it into two sums in a row; the inner loop gets its own sum and can be closed. No signal changes.')};
  case 'pickFwd':return {t:L('הזזת נקודת הסתעפות קדימה (מעבר לבלוק)','Moving a pick-off forward past a block'),why:L('הלולאות כאן שלובות — אף אחת לא נמצאת כולה בתוך השנייה — ולכן אף כלל פשוט לא מתאים. מזיזים את נקודת ההסתעפות אל אחרי הבלוק G. אחרי הבלוק האות כבר מוכפל ב-G, אז כדי שהענף ימשיך לקבל בדיוק את אותו אות מוסיפים לו בלוק 1/G.','These loops interlock — neither sits fully inside the other — so no simple rule applies. We move the pick-off to after block G. There the signal is already multiplied by G, so the branch gets an extra 1/G block to keep receiving exactly the same signal.')};
  case 'pickBack':return {t:L('הזזת נקודת הסתעפות אחורה (לפני בלוק)','Moving a pick-off back before a block'),why:L('מעבירים את נקודת ההסתעפות אל לפני הבלוק G כדי לפרק לולאות שלובות. לפני הבלוק האות עוד לא הוכפל ב-G, ולכן מוסיפים לענף בלוק G כדי שיקבל את אותו אות כמו קודם.','We move the pick-off to before block G to untangle interlocking loops. Before the block the signal has not been multiplied by G yet, so the branch gets a G block to keep the same signal.')};
  case 'sumFwd':return {t:L('הזזת מחבר קדימה (מעבר לבלוק)','Moving a sum forward past a block'),why:L('G·(X ± Y) = G·X ± G·Y. אם מזיזים את המחבר לאחרי הבלוק, כל כניסה נוספת למחבר חייבת לעבור גם היא דרך G.','G·(X ± Y) = G·X ± G·Y. Moving the sum after the block means every extra input must also pass through G.')};
  case 'sumBack':return {t:L('הזזת מחבר אחורה (לפני בלוק)','Moving a sum back before a block'),why:L('G·X ± Y = G·(X ± Y/G). אם מזיזים את המחבר לפני הבלוק, הכניסה הנוספת צריכה לעבור דרך 1/G.','G·X ± Y = G·(X ± Y/G). Moving the sum before the block means the extra input must go through 1/G.')};
 }
 return {t:st.rule,why:''};
}
function derivTex(st){
 const lab=x=>x?segLatex(x.seg):'1';
 const G=st.fwd||'G',H=st.fb||'H';
 const sF=st.sF<0?'-':'+',den=st.sF<0?'+':'-';
 const hY=H==='1'?'Y':`${H}\\,Y`,GH=H==='1'?G:(G==='1'?H:`${G}${H}`);const Gs=G==='1'?'':G+'\\,';
 const pre=st.sE<0?'-':'';
 return `\\begin{aligned}E &= ${pre}X ${sF} ${hY} \\\\ Y &= ${Gs}E = ${Gs}\\left(${pre}X ${sF} ${hY}\\right) \\\\ Y\\left(1 ${den} ${GH}\\right) &= ${pre}${Gs}X \\;\\Rightarrow\\; \\dfrac{Y}{X} = ${pre}\\dfrac{${G}}{1 ${den} ${GH}}\\end{aligned}`;
}

/* ---------- reduce / steps ---------- */
function startReduce(){
 revalidate();const errs=VAL.filter(v=>v.sev==='err');
 if(errs.length){tab='check';sideOpen();render();renderSide();toast(L(`יש ${errs.length} בעיות בדיאגרמה — ההסבר בלשונית "בדיקה"`,`${errs.length} problem(s) in the diagram — see the "Check" tab`));return;}
 const pr=prepared();
 const start=clone(pr.g);normalize(start);
 const r=reduce(pr.g);
 // attach names for derivations
 r.steps.forEach(s=>{if(s.rule==='feedback'||s.rule==='unity'){const m=s.eqLocal.match(/\\dfrac\{(.*?)\}\{1 [+-] /);s.fwd=m?m[1]:'G';
   const hb=s.hl.map(id=>nodeOf(s.before,id)).filter(n=>n&&n.type==='G');s.fwd=hb[0]&&!hb[0].flip?segLatex(hb[0].seg):(hb.find(n=>!n.flip)?segLatex(hb.find(n=>!n.flip).seg):'1');
   const fbn=hb.find(n=>n.flip)||hb[1];s.fb=s.rule==='unity'?'1':(fbn?segLatex(fbn.seg):'H');}});
 const ms=mason(pr.g,'n'),msx=mason(pr.g,'x');
 RED={start,steps:r.steps,done:r.done,final:r.done?r.final:ms.T,finalx:r.done?r.finalx:msx.T,mason:ms,masonx:msx,orig:clone(doc)};
 RED.agree=r.done?rfEquivalent(r.final,ms.T)===true:null;
 mode='steps';cur=0;sel=null;wireMode=false;wireFrom=null;tab='steps';sideOpen();
 render();renderSide();
 if(!r.done)toast(L('הצמצום נעצר — התוצאה הסופית חושבה לפי נוסחת מייסון','Reduction stopped — final result computed with Mason\'s formula'));
 else setTimeout(()=>play(),400);
}
function exitSteps(){stopAnim();mode='edit';RED=null;tab='node';render();renderSide();}
function stopAnim(){if(anim){anim.forEach(clearTimeout);anim=null;}playing=false;updatePlayer();}
function jump(i){stopAnim();const N=RED.steps.length;cur=Math.max(0,Math.min(N+1,i));render();renderSide();}
function transition(k,done){ // animate from state k to k+1
 const N=RED.steps.length;
 if(k>=N){cur=N+1;render();renderSide();done&&done();return;}
 const st=RED.steps[k],T=1000/speed;anim=[];
 cur=k;gDg.innerHTML=diagramSVG(st.before,{hl:st.hl});renderSide(k+1,true);updatePlayer();
 anim.push(setTimeout(()=>{gDg.innerHTML=diagramSVG(st.before,{hl:st.hl,fade:true});},T*0.9));
 anim.push(setTimeout(()=>{gDg.innerHTML=diagramSVG(st.g,{pop:st.add});cur=k+1;renderSide();updatePlayer();},T*1.45));
 anim.push(setTimeout(()=>{anim=null;done&&done();},T*2.3));
}
function play(){
 if(!RED)return;if(cur>RED.steps.length)cur=0;playing=true;updatePlayer();
 const next=()=>{if(!playing)return;if(cur>RED.steps.length){playing=false;updatePlayer();return;}
  transition(cur,()=>{if(cur>=RED.steps.length){cur=RED.steps.length+1;render();renderSide();playing=false;updatePlayer();return;}next();});};
 next();
}
function togglePlay(){if(playing){stopAnim();render();renderSide();}else play();}
function updatePlayer(){
 const p=$('player');p.classList.toggle('show',mode==='steps');if(mode!=='steps')return;
 const N=RED.steps.length;$('pCnt').textContent=`${Math.min(cur,N+1)}/${N+1}`;$('pPlay').textContent=playing?'⏸':'▶';
}

/* ---------- side panel ---------- */
function sideOpen(){$('side').classList.remove('min');}
function renderSide(focusIdx,animating){
 document.querySelectorAll('.tabs [data-tab]').forEach(b=>{b.classList.toggle('on',b.dataset.tab===tab);
  b.textContent={steps:L('שלבים','Steps'),node:L('רכיב','Item'),check:L('בדיקה','Check'),mason:L('מייסון','Mason')}[b.dataset.tab];});
 const pane=$('pane');
 if(tab==='steps')pane.innerHTML=stepsPane(focusIdx==null?cur:focusIdx);
 else if(tab==='node')pane.innerHTML=nodePane();
 else if(tab==='check')pane.innerHTML=checkPane();
 else pane.innerHTML=masonPane();
 bindPane();
 const c=pane.querySelector('li.cur');if(c&&c.scrollIntoView&&tab==='steps')c.scrollIntoView({block:'nearest'});
}
function stepTitle(i){
 const N=RED.steps.length;if(i===0)return L('התחלה — הדיאגרמה המקורית','Start — original diagram');if(i>N)return L('סופי: G_T = C/R','Final: G_T = C/R');
 const s=RED.steps[i-1],ri=ruleInfo(s);const nm=s.node?' → '+segText(s.node.seg):'';return ri.t+nm;
}
function stepTitleHTML(i){const N=RED.steps.length;if(i===0||i>N)return esc(stepTitle(i));const st=RED.steps[i-1];const ri=ruleInfo(st);
 return esc(ri.t)+(st.node?' → <bdi dir="ltr" style="font-family:var(--mono);font-size:12.5px">'+esc(segText(st.node.seg))+'</bdi>':'');}
function stepsPane(i){
 if(mode!=='steps'||!RED)return editHelp();
 const N=RED.steps.length;let h=`<div class="row" style="margin-top:0"><button data-act="replay">▶ ${L('הפעל מכאן','Replay from here')}</button><button data-act="edit">✏ ${L('חזרה לעריכה','Back to editing')}</button></div>`;
 h+=stepCard(i);
 h+=`<h4>${L('כל השלבים (הקש כדי לקפוץ)','All steps (tap to jump)')}</h4><ol class="steps">`;
 for(let k=0;k<=N+1;k++)h+=`<li data-step="${k}" class="${k===i?'cur':''}${k<i?' done':''}"><span class="n">${k===0?'◉':k>N?'✓':k}</span><span>${stepTitleHTML(k)}</span></li>`;
 return h+'</ol>';
}
function finalTex(){return 'G_T = \\dfrac{C(s)}{R(s)} = '+rfLatex(exprMode?RED.finalx:RED.final);}
function stepCard(i){
 const N=RED.steps.length;
 if(i===0){const loops=RED.mason.loops.length,paths=RED.mason.paths.length;
  return noteHTML()+`<div class="card"><div class="t">${L('המטרה','The goal')}</div><div class="why">${L(`לצמצם את כל הדיאגרמה לבלוק אחד G_T בין R ל-C. בדיאגרמה ${paths} מסלולים קדמיים ו-${loops} לולאות. בכל שלב מחליפים תת-מבנה מוכר (טור, מקביל, לולאה) בבלוק שקול — האות ב-C לא משתנה לאורך כל הדרך.`,`Reduce the whole diagram to one block G_T between R and C. It has ${paths} forward path(s) and ${loops} loop(s). Each step swaps a known sub-structure (series, parallel, loop) for an equivalent block — the signal at C never changes.`)}</div>
   <div class="lab">${L('סדר העבודה','Order of work')}</div><div class="why">${L('1) קודם בלוקים בטור ובמקביל. 2) אחר כך הלולאה הפנימית ביותר. 3) חוזרים על זה מבפנים החוצה. 4) אם לולאות שלובות — מזיזים נקודת הסתעפות או מחבר.','1) Series and parallel blocks first. 2) Then the innermost loop. 3) Repeat from the inside out. 4) If loops interlock, move a pick-off point or a sum.')}</div></div>`;}
 if(i>N){const ok=RED.agree;
  return `<div class="card final"><div class="t">${L('התמסורת הכוללת','Overall transfer function')}</div>${texHTML(finalTex())}
   <div class="row"><button data-act="exprToggle" class="${exprMode?'on':''}">${exprMode?L('מציג עם ביטויים','Showing expressions'):L('מציג בשמות הבלוקים','Showing block names')}</button></div>
   ${RED.done?`<div class="msg ${ok?'ok':'err'}">${ok?'✓ '+L('נבדק מול נוסחת מייסון — זהה.','Checked against Mason\'s formula — identical.'):'⚠ '+L('אי-התאמה מול מייסון!','Mismatch with Mason!')}</div>`:`<div class="msg warn">${L('הצמצום לא הסתיים בכללים הפשוטים; התוצאה מחושבת בנוסחת מייסון (ראה לשונית מייסון).','The rule-based reduction did not finish; the result uses Mason\'s formula (see the Mason tab).')}</div>`}
   <div class="lab">${L('איך לקרוא את התשובה','How to read it')}</div><div class="why">${L('המונה = מכפלת הבלוקים במסלול הקדמי. המכנה = 1 + סכום הגברי הלולאות (במשוב שלילי) — כל לולאה היא מכפלת הבלוקים שהיא עוברת בהם.','Numerator = product of the forward-path blocks. Denominator = 1 + sum of loop gains (negative feedback) — each loop gain is the product of the blocks around it.')}</div></div>`;}
 const s=RED.steps[i-1],ri=ruleInfo(s);
 let h=`<div class="card"><div class="t">${i}. ${esc(ri.t)}</div><div class="lab">${L('למה מותר?','Why is this allowed?')}</div><div class="why">${esc(ri.why)}</div>`;
 if(ri.deriv)h+=`<div class="lab">${L('הפיתוח','Derivation')}</div>${texHTML(derivTex(s))}`;
 h+=`<div class="lab">${L('לפני → אחרי','Before → after')}</div>${texHTML(s.eqLocal)}`;
 if(s.eqFull&&s.eqFull!==s.eqLocal)h+=`<div class="lab">${L('בשמות המקוריים','In the original blocks')}</div>${texHTML(s.eqFull)}`;
 if(s.node&&exprMode)h+=`<div class="lab">${L('עם הביטויים','With expressions')}</div>${texHTML(segLatex(s.node.seg)+' = '+rfLatex(s.node.rfx))}`;
 return h+'</div>';
}
function noteHTML(){const n=meta&&meta.notes?(meta.notes[lang]||meta.notes.en||meta.notes.he):'';return n?`<div class="msg warn"><b>🔗 ${L('הערה מהקישור (אנלוגיה)','Note from the link (analogy)')}</b>${esc(n)}</div>`:'';}
function editHelp(){
 return noteHTML()+`<div class="card"><div class="t">${L('איך עובדים','How it works')}</div><ul class="help" style="padding-inline-start:18px;margin:4px 0">${L(
  `<li><b>בונים:</b> גוררים מהסרגל R, C, בלוקים G, בלוקי משוב H, מחבר Σ ונקודת הסתעפות.</li><li><b>מחברים:</b> מצב "חוט" → הקש על רכיב המקור ואז על היעד. למחבר: כניסה משמאל = +, מלמעלה/מלמטה = − (אפשר להחליף).</li><li><b>עורכים:</b> הקש על בלוק כדי לשנות שם (G1, H2…) וביטוי (למשל 10/(s+1)).</li><li><b>צמצם ▶:</b> מריץ את הצמצום שלב אחר שלב עם אנימציה, משוואות והסבר. כל שלב ברשימה ניתן לקפיצה.</li><li><b>בדיקה:</b> הקלד תשובה משלך ובדוק אם היא שקולה.</li>`,
  `<li><b>Build:</b> drag R, C, G blocks, H feedback blocks, Σ and pick-off points from the palette.</li><li><b>Connect:</b> Wire mode → tap the source, then the target. At a sum: left input = +, top/bottom = − (toggle any time).</li><li><b>Edit:</b> tap a block to set its name (G1, H2…) and expression (e.g. 10/(s+1)).</li><li><b>Reduce ▶:</b> runs the reduction step by step with animation, equations and explanations. Every step in the list is clickable.</li><li><b>Check:</b> type your own answer and test whether it is equivalent.</li>`)}</ul></div>
  <div class="row"><button class="go" data-act="reduce">▶ ${L('צמצם עכשיו','Reduce now')}</button><button data-act="preset">📚 ${L('תרגיל הלוח','Board exercise')}</button></div>`;
}
function nodePane(){
 const g=curGraph();
 if(!sel)return mode==='edit'?editHelp():`<p style="color:var(--muted)">${L('הקש על בלוק בדיאגרמה כדי לראות מה הוא שווה.','Tap a block to see what it equals.')}</p>`;
 if(sel.kind==='edge'){const e=g.edges.find(x=>x.id===sel.id);if(!e)return '';const B=nodeOf(g,e.to);
  let h=`<h3>${L('חוט','Wire')}</h3>`;
  if(B&&B.type==='S')h+=`<div class="row"><span>${L('סימן במחבר:','Sign at the sum:')}</span><button class="sgn ${e.sign<0?'neg':'pos'}" data-act="sign">${e.sign<0?'−':'+'}</button></div><p style="color:var(--muted);font-size:13px">${L('− = האות מחוסר (משוב שלילי). + = האות מתווסף.','− = subtracted (negative feedback). + = added.')}</p>`;
  if(mode==='edit')h+=`<div class="row"><button data-act="del">🗑 ${L('מחק חוט','Delete wire')}</button></div>`;return h;}
 const n=nodeOf(g,sel.id);if(!n)return '';
 const ty=n.type==='G'?(n.flip?'H':'G'):n.type;let h=`<h3>${esc(L(NAMES[ty][0],NAMES[ty][1]))}</h3>`;
 if(n.type==='G'){
  if(mode==='edit'){
   h+=`<div class="fld"><label>${L('שם (סמל)','Name (symbol)')}</label><input data-f="name" value="${esc(n.name)}" spellcheck="false" autocomplete="off"></div>`;
   h+=`<div class="fld"><label>${L('ביטוי (רשות)','Expression (optional)')}</label><input data-f="expr" value="${esc(n.expr||'')}" placeholder="10/(s+1)" spellcheck="false" autocomplete="off"></div>`;
   h+=`<div class="row"><button data-act="flip">⇄ ${L('הפוך כיוון','Flip direction')}</button><button data-act="del">🗑 ${L('מחק','Delete')}</button></div>`;
   h+=`<p style="color:var(--muted);font-size:12.5px">${L('השם הוא הסמל באלגברה (G1, H2, K). הביטוי משמש במצב "עם ביטויים" — למשל 1/(s+2).','The name is the algebra symbol (G1, H2, K). The expression is used in "with expressions" mode — e.g. 1/(s+2).')}</p>`;
  }else if(n.rf){h+=texHTML(segLatex(n.seg)+' = '+rfLatex(n.rf));if(exprMode)h+=texHTML(segLatex(n.seg)+' = '+rfLatex(n.rfx));}
  else{const pr=prepare({nodes:[n],edges:[]}).g.nodes[0];h+=texHTML(segLatex(pr.seg)+(n.expr?' = '+rfLatex(pr.rfx):''));}
 }else if(n.type==='S'){
  const ie=g.edges.filter(e=>e.to===n.id);
  h+=`<p style="color:var(--muted);font-size:13px">${L('יציאת המחבר = סכום הכניסות עם הסימנים שלהן.','Output = sum of the inputs with their signs.')}</p>`;
  ie.forEach((e,i)=>{const A=nodeOf(g,e.from);const nm=A.type==='G'?segText(A.seg&&A.seg.length?A.seg:segFromName(A.name)):A.type==='P'?L('הסתעפות','pick-off'):A.type;
   h+=`<div class="row"><button class="sgn ${e.sign<0?'neg':'pos'}" data-act="signE" data-e="${e.id}" ${mode!=='edit'?'disabled':''}>${e.sign<0?'−':'+'}</button><span>${esc(nm)} <small style="color:var(--muted)">(${e.port==='W'?L('שמאל','left'):e.port==='N'?L('למעלה','top'):L('למטה','bottom')})</small></span></div>`;});
  if(mode==='edit')h+=`<div class="row"><button data-act="flip">⇄ ${L('הפוך כיוון','Flip')}</button><button data-act="del">🗑 ${L('מחק','Delete')}</button></div>`;
 }else{
  h+=`<p style="color:var(--muted);font-size:13px">${n.type==='P'?L('נקודת הסתעפות מעתיקה את אותו אות לכמה ענפים — בלי לשנות אותו.','A pick-off copies the same signal to several branches — unchanged.'):n.type==='R'?L('אות הכניסה R(s).','The input signal R(s).'):L('אות היציאה C(s).','The output signal C(s).')}</p>`;
  if(mode==='edit')h+=`<div class="row"><button data-act="del">🗑 ${L('מחק','Delete')}</button></div>`;
 }
 return h;
}
let lastCand='';
function checkPane(){
 revalidate();let h='';
 const errs=VAL.filter(v=>v.sev==='err'),warns=VAL.filter(v=>v.sev==='warn');
 if(!errs.length&&!warns.length)h+=`<div class="msg ok">✓ ${L('הטופולוגיה תקינה — אפשר לצמצם.','Topology is valid — ready to reduce.')}</div>`;
 for(const v of [...errs,...warns])h+=`<div class="msg ${v.sev}"><b>${v.sev==='err'?'⛔':'⚠'} ${esc(vmsg(v.k,0))}</b>${esc(vmsg(v.k,1))}<br><span style="color:var(--cyan)">${L('תיקון: ','Fix: ')}</span>${esc(vmsg(v.k,2))}</div>`;
 h+=`<h4>${L('בדוק את התשובה שלך','Check your own answer')}</h4><input class="cand" id="cand" value="${esc(lastCand)}" placeholder="G1G2G3/(1+G1H1+G1G2H2+G1G2G3H3)" spellcheck="false" autocomplete="off">
  <div class="row"><button class="pri" data-act="check">✓ ${L('בדוק שקילות','Check equivalence')}</button></div><div id="candOut"></div>`;
 if(!errs.length){const pr=prepared(),ms=mason(pr.g,'n'),mx=mason(pr.g,'x');
  h+=`<h4>${L('התשובה הנכונה','Correct answer')}</h4>${texHTML('G_T = '+rfLatex(ms.T))}`;
  if(rfLatex(mx.T)!==rfLatex(ms.T))h+=`<h4>${L('עם הביטויים','With expressions')}</h4>${texHTML('G_T = '+rfLatex(mx.T))}`;}
 return h;
}
function doCheck(){
 const inp=$('cand');lastCand=inp.value;const out=$('candOut');
 let c;try{c=parseExpr(inp.value);inp.classList.remove('bad');}catch(e){inp.classList.add('bad');out.innerHTML=`<div class="msg err">${L('לא הצלחתי לקרוא את הביטוי: ','Could not read the expression: ')}${esc(e.message)}</div>`;return;}
 const pr=prepared();revalidate();if(VAL.some(v=>v.sev==='err')){out.innerHTML=`<div class="msg err">${L('קודם תקן את בעיות הדיאגרמה.','Fix the diagram problems first.')}</div>`;return;}
 const ms=mason(pr.g,'n'),mx=mason(pr.g,'x');const cv=RF.vars(c),nv=RF.vars(ms.T),xv=RF.vars(mx.T);
 const subset=(a,b)=>[...a].every(v=>b.has(v));
 const ref=subset(cv,nv)?ms.T:subset(cv,xv)?mx.T:null;
 if(!ref){const unk=[...cv].filter(v=>!nv.has(v)&&!xv.has(v));out.innerHTML=`<div class="msg warn">${L('יש בתשובה סמלים שלא קיימים בדיאגרמה: ','Your answer uses symbols that are not in the diagram: ')}<b style="display:inline">${esc(unk.join(', '))}</b></div>`;return;}
 const r=rfEquivalent(c,ref);
 if(r===true){out.innerHTML=`<div class="msg ok">✓ ${L('נכון! התשובה שלך שקולה לתמסורת.','Correct! Your answer is equivalent.')}</div>${texHTML(rfLatex(c))}`;return;}
 const env=Object.entries(r.env).map(([k,v])=>k+'='+(+v.toFixed(3))).join(', ');
 // hint: compare denominators/numerators separately
 out.innerHTML=`<div class="msg err">✗ ${L('לא שקול.','Not equivalent.')}<br>${L('לדוגמה עבור','For example at')} <span style="font-family:var(--mono);direction:ltr;unicode-bidi:isolate">${esc(env)}</span>: ${L('שלך','yours')} = ${(+r.x.toPrecision(5))}, ${L('נכון','correct')} = ${(+r.y.toPrecision(5))}</div>
  <div class="why" style="font-size:13px;color:#c9d3df">${L('טיפ: בדוק שכל לולאה מופיעה במכנה עם המכפלה המלאה של הבלוקים שבה, ושסימן המשוב נכון (− במחבר → + במכנה).','Tip: check that every loop appears in the denominator with the full product of its blocks, and that the feedback sign is right (− at the sum → + in the denominator).')}</div>${texHTML(L('\\text{שלך: }','\\text{yours: }')+rfLatex(c))}`;
}
function masonPane(){
 revalidate();if(VAL.some(v=>v.sev==='err'))return `<div class="msg err">${L('תקן קודם את הבעיות בלשונית "בדיקה".','Fix the problems in the "Check" tab first.')}</div>`;
 const pr=prepared(),m=mason(pr.g,exprMode?'x':'n');
 let h=`<div class="card"><div class="t">${L('נוסחת ההגבר של מייסון','Mason\'s gain formula')}</div><div class="why">${L('דרך חלופית שלא דורשת צמצום: סוכמים את כל המסלולים הקדמיים, כל אחד כפול Δ של הלולאות שלא נוגעות בו, ומחלקים ב-Δ של כל הדיאגרמה.','An alternative that needs no reduction: sum every forward path times the Δ of the loops it does not touch, divided by the Δ of the whole diagram.')}</div>${texHTML('T = \\dfrac{\\sum_k P_k\\,\\Delta_k}{\\Delta},\\quad \\Delta = 1 - \\sum L_i + \\sum L_iL_j - \\dots')}</div>`;
 h+=`<h4>${L('מסלולים קדמיים','Forward paths')}</h4>`;m.paths.forEach((p,i)=>h+=texHTML(`P_{${i+1}} = ${rfLatex(p.P)},\\quad \\Delta_{${i+1}} = ${rfLatex(p.D)}`));
 h+=`<h4>${L('לולאות','Loops')}</h4>`;m.loops.forEach((l,i)=>h+=texHTML(`L_{${i+1}} = ${rfLatex(l.gain)}`));
 if(!m.loops.length)h+=`<p style="color:var(--muted)">${L('אין לולאות.','No loops.')}</p>`;
 h+=`<h4>Δ</h4>${texHTML('\\Delta = '+rfLatex(m.Delta))}<h4>${L('תוצאה','Result')}</h4>${texHTML('T = '+rfLatex(m.T))}`;
 h+=`<div class="row"><button data-act="exprToggle" class="${exprMode?'on':''}">${exprMode?L('עם ביטויים','With expressions'):L('בשמות הבלוקים','Block names')}</button></div>`;
 return h;
}
function bindPane(){
 const pane=$('pane');
 pane.querySelectorAll('[data-step]').forEach(li=>li.onclick=()=>jump(+li.dataset.step));
 pane.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{const a=b.dataset.act;
  if(a==='replay')play();else if(a==='edit')exitSteps();else if(a==='reduce')startReduce();else if(a==='preset')loadPreset('board');
  else if(a==='exprToggle'){exprMode=!exprMode;renderSide();}
  else if(a==='del')delSel();else if(a==='flip')flipSel();else if(a==='check')doCheck();
  else if(a==='sign'){const e=doc.edges.find(x=>x.id===sel.id);if(e){snap();e.sign=-e.sign;changed();}}
  else if(a==='signE'){const e=doc.edges.find(x=>x.id===b.dataset.e);if(e){snap();e.sign=-e.sign;changed();}}});
 const cand=$('cand');if(cand)cand.onkeydown=e=>{if(e.key==='Enter')doCheck();};
 let snapped=false;
 pane.querySelectorAll('input[data-f]').forEach(inp=>{inp.onfocus=()=>snapped=false;
  inp.oninput=()=>{const n=sel&&nodeOf(doc,sel.id);if(!n)return;if(!snapped){snap();snapped=true;}
   if(inp.dataset.f==='name'){const v=inp.value.trim();let ok=true;try{parseExpr(v||'?');}catch(e){ok=false;}inp.classList.toggle('bad',!ok||!v);if(ok&&v){n.name=v;delete n.seg;}}
   else{n.expr=inp.value;let ok=true;if(inp.value.trim())try{parseExpr(inp.value);}catch(e){ok=false;}inp.classList.toggle('bad',!ok);}
   save();render();};});
}

/* ---------- editing ---------- */
function save(){try{localStorage.setItem('cbl_doc',JSON.stringify({doc,meta}));}catch(e){}}
function load(){try{const s=JSON.parse(localStorage.getItem('cbl_doc')||'null');if(s&&s.doc&&Array.isArray(s.doc.nodes))return s;}catch(e){}return null;}
function snap(){hist.push(JSON.stringify(doc));if(hist.length>150)hist.shift();redoS=[];}
function changed(){if(mode==='steps')exitSteps();VAL=null;save();render();renderSide();}
function undo(){if(mode==='steps')exitSteps();if(!hist.length)return;redoS.push(JSON.stringify(doc));doc=JSON.parse(hist.pop());sel=null;changed();}
function redo(){if(mode==='steps')exitSteps();if(!redoS.length)return;hist.push(JSON.stringify(doc));doc=JSON.parse(redoS.pop());sel=null;changed();}
function delSel(){if(!sel||mode!=='edit')return;snap();if(sel.kind==='node'){doc.nodes=doc.nodes.filter(n=>n.id!==sel.id);doc.edges=doc.edges.filter(e=>e.from!==sel.id&&e.to!==sel.id);}else doc.edges=doc.edges.filter(e=>e.id!==sel.id);sel=null;changed();}
function flipSel(){if(!sel||sel.kind!=='node'||mode!=='edit')return;const n=nodeOf(doc,sel.id);if(!n||!(n.type==='G'||n.type==='S'))return;snap();n.flip=!n.flip;changed();}
function nextName(base){const used=new Set(doc.nodes.map(n=>n.name));let i=1;while(used.has(base+i))i++;return base+i;}
function addNode(t,x,y){
 if(mode==='steps')exitSteps();snap();
 if((t==='R'||t==='C')&&doc.nodes.some(n=>n.type===t)){toast(L('כבר יש '+(t==='R'?'כניסה':'יציאה')+' — אפשר רק אחת','There is already one '+(t==='R'?'input':'output')));hist.pop();return;}
 const n={id:nid(t.toLowerCase()),type:t==='H'?'G':t,x:Math.round(x/10)*10,y:Math.round(y/10)*10};
 if(t==='G')n.name=nextName('G');if(t==='H'){n.name=nextName('H');n.flip=true;}
 doc.nodes.push(n);sel={kind:'node',id:n.id};tab='node';sideOpen();changed();
}
function sumPortFor(S,from){const dx=from.x-S.x,dy=from.y-S.y;const f=S.flip?-1:1;if(dx*f<0&&Math.abs(dx)>=Math.abs(dy)*0.8)return 'W';return dy<0?'N':'S';}
function connect(fromId,toId){
 if(fromId===toId)return;const A=nodeOf(doc,fromId),B=nodeOf(doc,toId);
 if(A.type==='C'){toast(L('C הוא סוף המסלול — לקחת ממנו אות דרך נקודת הסתעפות','C is the end — take signals via a pick-off'));return;}
 if(B.type==='R'){toast(L('אי אפשר להכניס אות ל-R','Nothing can flow into R'));return;}
 if(doc.edges.some(e=>e.from===fromId&&e.to===toId)){toast(L('החיבור כבר קיים','Already connected'));return;}
 snap();let port='in',sign=1;
 if(B.type==='S'){port=sumPortFor(B,A);sign=port==='W'?1:-1;}
 doc.edges.push({id:nid('e'),from:fromId,to:toId,port,sign});
 if(B.type==='S'&&sign<0)toast(L('נוסף כקלט משוב עם סימן − (אפשר להחליף בלחיצה על החוט)','Added as feedback with − sign (tap the wire to toggle)'));
 changed();
}

/* ---------- pointer interaction ---------- */
const ptrs=new Map();let drag=null;
function svgXY(e){const r=svg.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
function toWorld(sx,sy){return [(sx-view.x)/view.s,(sy-view.y)/view.s];}
svg.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button>1)return;svg.setPointerCapture(e.pointerId);
 const [sx,sy]=svgXY(e);ptrs.set(e.pointerId,{sx,sy});
 if(ptrs.size===2){const [a,b]=[...ptrs.values()];drag={type:'pinch',d0:Math.hypot(a.sx-b.sx,a.sy-b.sy)||1,s0:view.s,w0:toWorld((a.sx+b.sx)/2,(a.sy+b.sy)/2)};return;}
 const t=e.target.closest?e.target.closest('[data-node],[data-edge]'):null;
 const base={sx,sy,vx:view.x,vy:view.y,moved:false};
 if(t&&t.dataset.node){const g=curGraph();const n=nodeOf(g,t.dataset.node);const [wx,wy]=toWorld(sx,sy);
  drag=Object.assign({type:mode==='edit'&&!wireMode?'move':'tapnode',id:n.id,ox:wx-n.x,oy:wy-n.y},base);return;}
 if(t&&t.dataset.edge){drag=Object.assign({type:'tapedge',id:t.dataset.edge},base);return;}
 drag=Object.assign({type:'pan'},base);
});
svg.addEventListener('pointermove',e=>{
 const [sx,sy]=svgXY(e);if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{sx,sy});
 if(wireFrom&&e.pointerType!=='touch'){hoverW=toWorld(sx,sy);renderOverlay();}
 if(!drag)return;
 if(drag.type==='pinch'&&ptrs.size>=2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.sx-b.sx,a.sy-b.sy);const mx=(a.sx+b.sx)/2,my=(a.sy+b.sy)/2;
  view.s=Math.min(3,Math.max(0.3,drag.s0*d/drag.d0));view.x=mx-drag.w0[0]*view.s;view.y=my-drag.w0[1]*view.s;applyView();return;}
 const dx=sx-drag.sx,dy=sy-drag.sy;if(!drag.moved&&Math.hypot(dx,dy)>6)drag.moved=true;if(!drag.moved)return;
 if(drag.type==='pan'||drag.type==='tapnode'||drag.type==='tapedge'){view.x=drag.vx+dx;view.y=drag.vy+dy;applyView();}
 else if(drag.type==='move'){const n=nodeOf(doc,drag.id);const [wx,wy]=toWorld(sx,sy);const nx=Math.round((wx-drag.ox)/10)*10,ny=Math.round((wy-drag.oy)/10)*10;
  if(nx!==n.x||ny!==n.y){if(!drag.snapped){snap();drag.snapped=true;}n.x=nx;n.y=ny;render();}}
});
function endPtr(e){
 ptrs.delete(e.pointerId);if(!drag)return;const d=drag;drag=null;if(d.type==='pinch')return;
 if(d.type==='move'&&d.moved){save();VAL=null;render();return;}
 if(d.moved)return;
 if(d.type==='move'||d.type==='tapnode'){
  if(mode==='edit'&&(wireMode||wireFrom)){if(!wireFrom){const n=nodeOf(doc,d.id);if(n.type==='C'){toast(L('התחל חוט ממקור האות','Start the wire at the signal source'));return;}wireFrom=d.id;sel={kind:'node',id:d.id};render();updateHint();return;}
   const f=wireFrom;wireFrom=null;hoverW=null;connect(f,d.id);updateHint();return;}
  sel={kind:'node',id:d.id};tab='node';sideOpen();render();renderSide();return;}
 if(d.type==='tapedge'){sel={kind:'edge',id:d.id};tab='node';sideOpen();render();renderSide();return;}
 if(d.type==='pan'){if(wireFrom){wireFrom=null;hoverW=null;renderOverlay();updateHint();}
  if(sel){sel=null;render();renderSide();}}
}
svg.addEventListener('pointerup',endPtr);svg.addEventListener('pointercancel',endPtr);
svg.addEventListener('wheel',e=>{e.preventDefault();const [sx,sy]=svgXY(e);zoomAt(sx,sy,Math.exp(-e.deltaY*0.0015));},{passive:false});
function zoomAt(sx,sy,f){const w=toWorld(sx,sy);view.s=Math.min(3,Math.max(0.3,view.s*f));view.x=sx-w[0]*view.s;view.y=sy-w[1]*view.s;applyView();}
function bboxOf(g){let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;const add=(x,y)=>{x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y);};
 g.nodes.forEach(n=>{const w=n.type==='G'?blkW(n)/2:20;add(n.x-w-10,n.y-30);add(n.x+w+10,n.y+40);});
 g.edges.forEach(e=>{const r=route(g,e);if(r)r.pts.forEach(p=>add(p[0],p[1]+(p[1]>y2-5?24:0)));});
 if(x1>x2)return [0,0,500,300];return [x1-10,y1-10,x2+10,y2+16];}
function fit(g){const r=svg.getBoundingClientRect();if(!r.width||!r.height)return;const [x1,y1,x2,y2]=bboxOf(g||curGraph());
 const s=Math.min(1.6,Math.max(0.3,Math.min((r.width-24)/(x2-x1),(r.height-110)/(y2-y1))));view.s=s;view.x=(r.width-(x2-x1)*s)/2-x1*s;view.y=(r.height-70-(y2-y1)*s)/2-y1*s+20;applyView();}

/* ---------- palette ---------- */
const PAL=['R','G','H','S','P','C'];
function palIcon(t){
 if(t==='G'||t==='H')return nodeSVG({type:'G',x:0,y:0,name:t==='G'?'G':'H',flip:t==='H'},'');
 return nodeSVG({type:t,x:0,y:0},'',true);}
function buildPalette(){const pal=$('pal');pal.innerHTML='';
 for(const t of PAL){const d=document.createElement('div');d.className='pi';d.dataset.t=t;
  d.innerHTML=`<svg viewBox="-46 -26 92 52">${palIcon(t)}</svg><span>${esc(L(NAMES[t][0],NAMES[t][1]))}</span>`;pal.appendChild(d);d.addEventListener('pointerdown',palDown);}}
let pd=null;
function palDown(e){e.preventDefault();pd={t:e.currentTarget.dataset.t,x:e.clientX,y:e.clientY,moved:false,id:e.pointerId};
 window.addEventListener('pointermove',palMove);window.addEventListener('pointerup',palUp);window.addEventListener('pointercancel',palUp);}
function palMove(e){if(!pd||e.pointerId!==pd.id)return;
 if(!pd.moved&&Math.hypot(e.clientX-pd.x,e.clientY-pd.y)>8){pd.moved=true;const g=$('ghost');g.innerHTML=palIcon(pd.t);g.style.display='block';}
 if(pd.moved){const g=$('ghost');g.style.left=(e.clientX-30)+'px';g.style.top=(e.clientY-17)+'px';}}
function palUp(e){if(!pd||e.pointerId!==pd.id)return;window.removeEventListener('pointermove',palMove);window.removeEventListener('pointerup',palUp);window.removeEventListener('pointercancel',palUp);
 $('ghost').style.display='none';const t=pd.t,moved=pd.moved;pd=null;const r=svg.getBoundingClientRect();
 if(moved){if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){const [wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);addNode(t,wx,wy);}}
 else{let [wx,wy]=toWorld(r.width/2,r.height/2);while(doc.nodes.some(n=>Math.abs(n.x-wx)<50&&Math.abs(n.y-wy)<40))wy+=60;addNode(t,wx,wy);}}

/* ---------- export ---------- */
function exportSVG(g){
 g=g||curGraph();const [x1,y1,x2,y2]=bboxOf(g);const w=x2-x1,h=y2-y1;const keep=sel;sel=null;const inner=diagramSVG(g,{exp:true});sel=keep;
 const css=`.wire{stroke:#334155;stroke-width:2;fill:none}.wire.fb{stroke:#6d28d9}.blk rect.b{fill:#fff;stroke:#111;stroke-width:2}.blk.fbk rect.b{stroke:#6d28d9}.blk text.nm{fill:#111;font:600 15px Arial,sans-serif}.blk text.ex{fill:#555;font:11px Consolas,monospace}.sum circle{fill:#fff;stroke:#111;stroke-width:2}.sum path{stroke:#111;stroke-width:1.6}.pk{fill:#111}.io circle{fill:#e0f2fe;stroke:#0369a1;stroke-width:2}.io text{fill:#0369a1;font:600 13px Arial,sans-serif}.sg{font:700 14px Consolas,monospace}.sg.p{fill:#047857}.sg.m{fill:#b91c1c}`;
 const defs=`<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#334155"/></marker><marker id="arf" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#6d28d9"/></marker></defs>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x1} ${y1} ${w} ${h}" width="${Math.round(w)}" height="${Math.round(h)}"><style>${css}</style>${defs}<rect x="${x1}" y="${y1}" width="${w}" height="${h}" fill="#fff"/>${inner}</svg>`;
}
function svgToPng(str,scale){return new Promise((res,rej)=>{const img=new Image();const url=URL.createObjectURL(new Blob([str],{type:'image/svg+xml'}));
 img.onload=()=>{const c=document.createElement('canvas');c.width=Math.ceil(img.width*scale);c.height=Math.ceil(img.height*scale);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(b=>b?res(b):rej(),'image/png');};
 img.onerror=()=>{URL.revokeObjectURL(url);rej();};img.src=url;});}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
function doPrint(){
 const p=$('print');p.setAttribute('dir',lang==='he'?'rtl':'ltr');
 let h=`<h2>${L('מעבדת דיאגרמות בלוקים','Control Block Lab')}</h2>${exportSVG(mode==='steps'&&RED?RED.start:doc)}`;
 if(mode==='steps'&&RED){RED.steps.forEach((s,i)=>{const ri=ruleInfo(s);h+=`<div class="pst"><b>${i+1}. ${esc(ri.t)}</b><div>${esc(ri.why)}</div>${texHTML(s.eqLocal)}${s.eqFull&&s.eqFull!==s.eqLocal?texHTML(s.eqFull):''}</div>`;});
  h+=`<div class="pst"><b>${L('סופי','Final')}</b>${texHTML(finalTex())}</div>`;}
 p.innerHTML=h;setTimeout(()=>window.print(),80);
}
function envelope(){return linkEnvelope('control-block-lab','block-diagram',{nodes:doc.nodes,edges:doc.edges},{title:meta.title||L('דיאגרמת בלוקים','Block diagram'),notes:meta.notes,template:meta.template,extra:meta.extra});}
function saveJSON(){download(new Blob([JSON.stringify(envelope(),null,1)],{type:'application/json'}),'block-diagram.json');}
function importEnvelope(env,src){
 if(!env||env.error){toast(L('קישור לא תקין','Invalid link'));return false;}
 if(env.schema===LINK_SCHEMA){
  if(env.kind==='circuit'){menuMsg(L('זה קובץ של מעגל חשמלי (Circuit Lab).','This is an electric circuit (Circuit Lab) file.'),[[L('פתח במעבדת המעגלים','Open in Circuit Lab'),()=>window.open(linkURL('circuit-lab',env),'_blank')]]);return false;}
  if(env.kind!=='block-diagram'||!env.data||!Array.isArray(env.data.nodes)){toast(L('סוג לא נתמך','Unsupported kind'));return false;}
  const unk=linkUnknownKeys(env);const extra={};unk.forEach(k=>extra[k]=env[k]);
  snap();doc={nodes:env.data.nodes,edges:env.data.edges||[]};meta={title:env.title,notes:env.notes,template:env.template,extra};
  if(mode==='steps')exitSteps();sel=null;changed();fit();
  const note=env.notes?(env.notes[lang]||env.notes.en||env.notes.he):'';
  toast((env.app==='circuit-lab'?L('נפתח מתוך מעבדת המעגלים. ','Opened from Circuit Lab. '):'')+(unk.length?L(`(${unk.length} שדות לא מוכרים נשמרו)`,`(${unk.length} unknown fields preserved)`):'')+(note?' '+note:''));
  if(note){meta.showNote=note;}
  return true;}
 if(Array.isArray(env.nodes)){snap();doc={nodes:env.nodes,edges:env.edges||[]};meta={};changed();fit();return true;}
 toast(L('קובץ לא מזוהה','Unrecognised file'));return false;
}
$('fileIn').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{importEnvelope(JSON.parse(await f.text()),'file');}catch(err){toast(L('קובץ לא תקין','Invalid file'));}e.target.value='';};

/* ---------- block → circuit template ---------- */
function circuitTemplate(){
 revalidate();if(VAL.some(v=>v.sev==='err'))return {err:L('קודם תקן את בעיות הדיאגרמה.','Fix the diagram first.')};
 const g=prepared().g;normalize(g);cleanupAll(g);
 const S=g.nodes.filter(n=>n.type==='S'),Gs=g.nodes.filter(n=>n.type==='G'),P=g.nodes.filter(n=>n.type==='P');
 if(S.length!==1||P.length!==1||Gs.length<1||Gs.length>2)return null;
 const s=S[0],p=P[0],so=g.edges.filter(e=>e.from===s.id);if(so.length!==1)return null;const fw=nodeOf(g,so[0].to);if(fw.type!=='G')return null;
 const fo=g.edges.filter(e=>e.from===fw.id);if(fo.length!==1||fo[0].to!==p.id)return null;
 const si=g.edges.filter(e=>e.to===s.id);if(si.length!==2)return null;
 const ext=si.find(e=>nodeOf(g,e.from).type==='R'),fb=si.find(e=>e!==ext);if(!ext||!fb||ext.sign!==1||fb.sign!==-1)return null;
 let beta=1;const fbn=nodeOf(g,fb.from);
 if(fbn.type==='G'){if(g.edges.filter(e=>e.to===fbn.id)[0].from!==p.id)return null;const v=RF.vars(fbn.rfx);beta=v.size===0?fbn.rfx.c:NaN;}
 else if(fbn.id!==p.id)return null;
 let note=null;if(!(beta>0&&beta<=1)){note=L('ל-H אין ערך מספרי בין 0 ל-1, אז נבחר β = 0.1 לדוגמה (הגבר ≈ 10).','H has no numeric value in (0,1], so β = 0.1 was used as an example (gain ≈ 10).');beta=0.1;}
 const R1=10000,Rf=R1*(1/beta-1);
 return {beta,R1,Rf,note,data:beta>=0.9999?followerCircuit():noninvCircuit(R1,Rf)};
}
function cleanupAll(g){let ch=true;while(ch){ch=false;for(const n of g.nodes){const i=g.edges.filter(e=>e.to===n.id),o=g.edges.filter(e=>e.from===n.id);
 if(n.type==='P'&&i.length===1&&o.length===1){o[0].from=i[0].from;g.edges=g.edges.filter(e=>e!==i[0]);g.nodes=g.nodes.filter(x=>x!==n);ch=true;break;}}}}
function engStr(v){const u=[[1e6,'M'],[1e3,'k'],[1,'']];for(const [m,s] of u)if(v>=m)return (+(v/m).toPrecision(3))+s;return String(+v.toPrecision(3));}
function cp(id,type,x,y,rot,name,props){return {id,type,x,y,rot,name,props};}
function noninvCircuit(R1,Rf){return {parts:[cp('p1','V',100,240,0,'Vin',{V:'1'}),cp('p2','G',100,280,0,'GND',{}),cp('p3','OA',300,180,0,'U1',{A:'1e6',Vsat:'13',Imax:'25m'}),cp('p4','R',200,160,0,'R1',{R:engStr(R1),Pmax:'0.25'}),cp('p5','G',160,160,0,'GND',{}),cp('p6','R',300,100,0,'Rf',{R:engStr(Rf),Pmax:'0.25'})],
 wires:[{id:'w1',pts:[[100,200],[260,200]]},{id:'w2',pts:[[240,160],[260,160]]},{id:'w3',pts:[[240,160],[240,100],[260,100]]},{id:'w4',pts:[[340,100],[360,100],[360,180],[340,180]]}]};}
function followerCircuit(){return {parts:[cp('p1','V',100,240,0,'Vin',{V:'1'}),cp('p2','G',100,280,0,'GND',{}),cp('p3','OA',260,180,0,'U1',{A:'1e6',Vsat:'13',Imax:'25m'}),cp('p4','R',360,220,1,'RL',{R:'10k',Pmax:'0.25'}),cp('p5','G',360,260,0,'GND',{})],
 wires:[{id:'w1',pts:[[100,200],[220,200]]},{id:'w2',pts:[[220,160],[200,160],[200,100],[320,100],[320,180]]},{id:'w3',pts:[[300,180],[360,180]]}]};}
function openCircuit(download_){
 const t=circuitTemplate();
 if(!t){menuMsg(L('אין עדיין מיפוי למעגל עבור הדיאגרמה הזו. המיפוי עובד רק לתבנית אחת: לולאה בודדת עם משוב שלילי (R → Σ → G → C ומשוב H). זו אנלוגיה, לא תרגום כללי.','No circuit mapping exists for this diagram yet. Only one template maps: a single negative-feedback loop (R → Σ → G → C with feedback H). It is an analogy, not a general translation.'),[]);return;}
 if(t.err){toast(t.err);return;}
 const notes={he:`אנלוגיה בלבד: מגבר לא מהפך שבו β = R1/(R1+Rf) = ${(+t.beta.toPrecision(3))} ממלא את תפקיד H, והמגבר (A) את תפקיד G. כש-A→∞ ההגבר ≈ 1/β = ${(+(1/t.beta).toPrecision(3))}.${t.note?' '+L(t.note,t.note):''}`,
  en:`Analogy only: a non-inverting op-amp where β = R1/(R1+Rf) = ${(+t.beta.toPrecision(3))} plays H and the op-amp gain A plays G. As A→∞ the gain ≈ 1/β = ${(+(1/t.beta).toPrecision(3))}.`};
 const env=linkEnvelope('control-block-lab','circuit',t.data,{title:L('רמז מעגל מדיאגרמת בלוקים','Circuit hint from a block diagram'),template:t.beta>=0.9999?'voltage-follower':'non-inverting-amp',notes});
 if(download_){download(new Blob([JSON.stringify(env,null,1)],{type:'application/json'}),'circuit-hint.json');return;}
 window.open(linkURL('circuit-lab',env),'_blank');
}

/* ---------- menus / toast ---------- */
function menu(anchor,items){closeMenu();const m=document.createElement('div');m.className='menu';m.id='menu';
 items.forEach(it=>{if(it==='-'){m.appendChild(document.createElement('hr'));return;}const b=document.createElement('button');b.textContent=it[0];b.onclick=()=>{closeMenu();it[1]();};m.appendChild(b);});
 document.body.appendChild(m);const r=anchor?anchor.getBoundingClientRect():{left:innerWidth/2,right:innerWidth/2,bottom:innerHeight/3};
 let left=lang==='he'?r.right-m.offsetWidth:r.left;left=Math.max(6,Math.min(left,innerWidth-m.offsetWidth-6));m.style.left=left+'px';m.style.top=(r.bottom+4)+'px';
 setTimeout(()=>document.addEventListener('pointerdown',outside),0);}
function menuMsg(text,actions){closeMenu();const m=document.createElement('div');m.className='menu';m.id='menu';m.style.padding='12px';
 m.innerHTML=`<div style="font-size:14px;line-height:1.5;margin-bottom:8px">${esc(text)}</div>`;
 [...actions,[L('סגור','Close'),()=>{}]].forEach(([l,fn])=>{const b=document.createElement('button');b.textContent=l;b.style.border='1px solid var(--line)';b.onclick=()=>{closeMenu();fn();};m.appendChild(b);});
 document.body.appendChild(m);m.style.left=Math.max(6,(innerWidth-m.offsetWidth)/2)+'px';m.style.top=Math.max(60,innerHeight/4)+'px';setTimeout(()=>document.addEventListener('pointerdown',outside),0);}
function outside(e){const m=$('menu');if(m&&!m.contains(e.target))closeMenu();}
function closeMenu(){const m=$('menu');if(m)m.remove();document.removeEventListener('pointerdown',outside);}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),3200);}
function updateHint(){
 let h='';if(mode==='edit'){if(wireFrom)h=L('עכשיו הקש על היעד (בלוק, מחבר, הסתעפות או C)','Now tap the target (block, sum, pick-off or C)');else if(wireMode)h=L('מצב חוט: הקש על מקור האות (R, בלוק, מחבר או הסתעפות)','Wire mode: tap the signal source (R, block, sum or pick-off)');else if(!doc.nodes.length)h=L('גרור רכיבים מהסרגל, או טען את "תרגיל הלוח"','Drag parts from the palette, or load the "Board exercise"');}
 $('hint').textContent=h;}
function updateToolbar(){
 $('bSel').classList.toggle('on',!wireMode);$('bWire').classList.toggle('on',wireMode);
 const ed=mode==='edit';['bSel','bWire','bFlip','bDel'].forEach(id=>$(id).disabled=!ed);
 $('bFlip').disabled=!ed||!(sel&&sel.kind==='node'&&doc&&nodeOf(doc,sel.id)&&['G','S'].includes(nodeOf(doc,sel.id).type));$('bDel').disabled=!ed||!sel;
 $('bUndo').disabled=!hist.length;$('bRedo').disabled=!redoS.length;
 $('bReduce').classList.toggle('on',mode==='steps');$('bReduce').textContent=mode==='steps'?'■ '+L('עצור צמצום','Stop'):'▶ '+L('צמצם','Reduce');
 $('bEdit').style.display=mode==='steps'?'':'none';
 const mt=$('modeTag');mt.className=mode==='steps'?'steps':'';mt.textContent=mode==='steps'?L('מצב צמצום — צפייה','Reduction view'):L('מצב עריכה','Edit mode');
 updatePlayer();updateHint();}
function applyLang(){
 document.documentElement.lang=lang;document.documentElement.dir=lang==='he'?'rtl':'ltr';
 document.querySelector('header h1').innerHTML=L('🧩 <b>מעבדת</b> בלוקים','🧩 <b>Control</b> Block Lab');document.title=L('מעבדת דיאגרמות בלוקים – Control Block Lab','Control Block Lab');
 $('bEdit').textContent='✏ '+L('עריכה','Edit');$('bSel').textContent='↖ '+L('בחירה','Select');$('bWire').textContent='→ '+L('חוט','Wire');$('bFlip').textContent='⇄ '+L('הפוך','Flip');$('bDel').textContent='🗑 '+L('מחק','Delete');
 $('bPre').textContent='📚 '+L('תרגילים','Exercises');$('bNew').textContent='✚ '+L('חדש','New');$('bExp').textContent='📤 '+L('ייצוא / קישור','Export / Link');$('bCircuit').textContent='⚡ '+L('מעבדת מעגלים','Circuit Lab');
 $('bLang').textContent=lang==='he'?'EN':'עב';buildPalette();renderSide();updateToolbar();}
function loadPreset(k){if(mode==='steps')exitSteps();snap();doc=mkPreset(k);meta={};sel=null;changed();fit();}
$('bReduce').onclick=()=>mode==='steps'?exitSteps():startReduce();
$('bEdit').onclick=exitSteps;
$('bSel').onclick=()=>{wireMode=false;wireFrom=null;render();};
$('bWire').onclick=()=>{wireMode=!wireMode;wireFrom=null;render();};
$('bFlip').onclick=flipSel;$('bDel').onclick=delSel;$('bUndo').onclick=undo;$('bRedo').onclick=redo;
$('bPre').onclick=e=>menu(e.currentTarget,PRESETS.map(([k,n])=>[L(n[0],n[1]),()=>loadPreset(k)]));
$('bNew').onclick=()=>{if(doc.nodes.length&&!confirm(L('למחוק את הדיאגרמה?','Clear the diagram?')))return;if(mode==='steps')exitSteps();snap();doc={nodes:[],edges:[]};meta={};sel=null;changed();};
$('bExp').onclick=e=>menu(e.currentTarget,[
 ['⬇ '+L('הורד PNG','Download PNG'),()=>svgToPng(exportSVG(),2).then(b=>download(b,'block-diagram.png'))],
 ['⬇ '+L('הורד SVG','Download SVG'),()=>download(new Blob([exportSVG()],{type:'image/svg+xml'}),'block-diagram.svg')],
 ['🖨 '+L('הדפס / PDF (כולל כל השלבים)','Print / PDF (with all steps)'),doPrint],'-',
 ['💾 '+L('שמור JSON','Save JSON'),saveJSON],['📂 '+L('טען JSON','Load JSON'),()=>$('fileIn').click()],'-',
 ['⚡ '+L('פתח רמז מעגל במעבדת המעגלים','Open related circuit hint in Circuit Lab'),()=>openCircuit(false)],
 ['⬇ '+L('הורד קובץ קישור למעגל (offline)','Download circuit link file (offline)'),()=>openCircuit(true)],
 ['🔗 '+L('העתק קישור לדיאגרמה הזו','Copy a link to this diagram'),()=>{const u=LINK_URLS['control-block-lab']+'#link='+linkEncode(envelope());(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>toast(L('הקישור הועתק','Link copied')),()=>toast(u));}],
]);
$('bCircuit').onclick=()=>window.open(LINK_URLS['circuit-lab'],'_blank');
$('bLang').onclick=()=>{lang=lang==='he'?'en':'he';try{localStorage.setItem('cbl_lang',lang);}catch(e){}applyLang();render();};
document.querySelectorAll('.tabs [data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;sideOpen();renderSide();});
$('sideMin').onclick=()=>{$('side').classList.toggle('min');$('sideMin').textContent=$('side').classList.contains('min')?'▴':'▾';};
$('zIn').onclick=()=>{const r=svg.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1.25);};
$('zOut').onclick=()=>{const r=svg.getBoundingClientRect();zoomAt(r.width/2,r.height/2,0.8);};
$('zFit').onclick=()=>fit();
$('pFirst').onclick=()=>jump(0);$('pPrev').onclick=()=>jump(cur-1);$('pNext').onclick=()=>{if(!RED)return;stopAnim();if(cur<=RED.steps.length)transition(cur,()=>{});};$('pLast').onclick=()=>jump(RED?RED.steps.length+1:0);
$('pPlay').onclick=togglePlay;$('pSpeed').onchange=e=>speed=+e.target.value;
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const k=e.key.toLowerCase();
 if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
 if(mode==='steps'){if(k==='arrowright'||k==='arrowleft'){const fw=(k==='arrowright')!==(lang==='he');jump(cur+(fw?1:-1));}else if(k===' '){e.preventDefault();togglePlay();}else if(k==='escape')exitSteps();return;}
 if(k==='delete'||k==='backspace'){delSel();e.preventDefault();}else if(k==='w')$('bWire').click();else if(k==='f')flipSel();else if(k==='enter')startReduce();
 else if(k==='escape'){wireFrom=null;wireMode=false;sel=null;render();renderSide();}});
window.addEventListener('resize',applyView);

/* ---------- boot ---------- */
(function boot(){
 const s=load();doc=s?s.doc:mkPreset('board');meta=s?s.meta||{}:{};
 tab='steps';applyLang();render();requestAnimationFrame(()=>fit());
 const env=linkFromHash();if(env){linkClearHash();importEnvelope(env,'hash');}
 // re-render equations once KaTeX finishes loading
 const wait=setInterval(()=>{if(window.katex){clearInterval(wait);renderSide();}},300);setTimeout(()=>clearInterval(wait),15000);
})();
