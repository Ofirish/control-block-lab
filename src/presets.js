/* ===================== presets ===================== */
function mkPreset(name){
 const nodes=[],edges=[];let k=0;
 const N=(type,x,y,o)=>{const n=Object.assign({id:type.toLowerCase()+(++k),type,x,y},o||{});nodes.push(n);return n.id;};
 const E=(from,to,port,sign)=>edges.push({id:'e'+(++k),from,to,port:port||'in',sign:sign==null?1:sign});
 if(name==='board'){ // golden exercise: GT = G1G2G3 / (1 + G1H1 + G1G2H2 + G1G2G3H3)
  const r=N('R',40,140),s1=N('S',120,140),s2=N('S',190,140),s3=N('S',260,140);
  const g1=N('G',350,140,{name:'G1'}),p1=N('P',430,140),g2=N('G',510,140,{name:'G2'}),p2=N('P',590,140),g3=N('G',670,140,{name:'G3'}),p3=N('P',750,140),c=N('C',820,140);
  const h1=N('G',390,220,{name:'H1',flip:true}),h2=N('G',470,290,{name:'H2',flip:true}),h3=N('G',550,360,{name:'H3',flip:true});
  E(r,s1,'W');E(s1,s2,'W');E(s2,s3,'W');E(s3,g1);E(g1,p1);E(p1,g2);E(g2,p2);E(p2,g3);E(g3,p3);E(p3,c);
  E(p1,h1);E(h1,s3,'S',-1);E(p2,h2);E(h2,s2,'S',-1);E(p3,h3);E(h3,s1,'S',-1);
 }else if(name==='boardOneSum'){ // same exercise, one summing junction with 4 inputs
  const r=N('R',40,140),s=N('S',140,140);
  const g1=N('G',240,140,{name:'G1'}),p1=N('P',320,140),g2=N('G',400,140,{name:'G2'}),p2=N('P',480,140),g3=N('G',560,140,{name:'G3'}),p3=N('P',640,140),c=N('C',710,140);
  const h1=N('G',280,220,{name:'H1',flip:true}),h2=N('G',360,290,{name:'H2',flip:true}),h3=N('G',440,360,{name:'H3',flip:true});
  E(r,s,'W');E(s,g1);E(g1,p1);E(p1,g2);E(g2,p2);E(p2,g3);E(g3,p3);E(p3,c);
  E(p1,h1);E(h1,s,'S',-1);E(p2,h2);E(h2,s,'S',-1);E(p3,h3);E(h3,s,'S',-1);
 }else if(name==='loop'){
  const r=N('R',40,120),s=N('S',130,120),g=N('G',250,120,{name:'G',expr:'10/(s+1)'}),p=N('P',350,120),c=N('C',430,120),h=N('G',250,210,{name:'H',flip:true,expr:'0.5'});
  E(r,s,'W');E(s,g);E(g,p);E(p,c);E(p,h);E(h,s,'S',-1);
 }else if(name==='parallel'){
  const r=N('R',40,140),p=N('P',110,140),g1=N('G',220,90,{name:'G1'}),g2=N('G',220,190,{name:'G2'}),s=N('S',330,140),g3=N('G',430,140,{name:'G3'}),c=N('C',520,140);
  E(r,p);E(p,g1);E(p,g2);E(g1,s,'N',1);E(g2,s,'S',-1);E(s,g3);E(g3,c);
 }else if(name==='interlock'){ // needs moving a pick-off point
  const r=N('R',40,140),s1=N('S',110,140),g1=N('G',200,140,{name:'G1'}),s2=N('S',290,140),g2=N('G',380,140,{name:'G2'}),p1=N('P',460,140),g3=N('G',540,140,{name:'G3'}),p2=N('P',620,140),c=N('C',690,140);
  const h1=N('G',300,240,{name:'H1',flip:true}),h2=N('G',460,40,{name:'H2',flip:true});
  E(r,s1,'W');E(s1,g1);E(g1,s2,'W');E(s2,g2);E(g2,p1);E(p1,g3);E(g3,p2);E(p2,c);
  E(p1,h1);E(h1,s1,'S',-1);E(p2,h2);E(h2,s2,'N',-1);
 }else if(name==='servo'){ // op-amp non-inverting analogy
  const r=N('R',40,120),s=N('S',130,120),g=N('G',250,120,{name:'A',expr:'A'}),p=N('P',350,120),c=N('C',430,120),h=N('G',250,210,{name:'β',flip:true,expr:'R1/(R1+Rf)'});
  E(r,s,'W');E(s,g);E(g,p);E(p,c);E(p,h);E(h,s,'S',-1);
 }
 return {nodes,edges};
}
const PRESETS=[['board',['תרגיל הלוח: 3 לולאות מקוננות','Board exercise: 3 nested loops']],['boardOneSum',['תרגיל הלוח — מחבר אחד עם 4 כניסות','Board exercise — one 4-input sum']],['loop',['לולאת משוב בודדת','Single feedback loop']],['parallel',['מקביל + טור','Parallel + series']],['interlock',['לולאות שלובות (הזזת נקודת הסתעפות)','Interlocking loops (move a pick-off)']],['servo',['מגבר לא מהפך כלולאה (אנלוגיה)','Non-inverting op-amp as a loop (analogy)']]];
if(typeof module!=='undefined')module.exports={mkPreset,PRESETS};
