(function(root){
'use strict';
function number(v,min=0,max=1e15){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Revisa los montos y tasas ingresados.');return v;}
function period(v,max=1200){number(v,1,max);if(!Number.isInteger(v))throw Error('Usa períodos completos.');return v;}
function compute(tool,d){const rows=[];let balance,total=0;
 if(tool==='prestamo'){const a=number(d.principal,0.000001),r=number(d.rate,0,1000)/100,n=period(d.months);const payment=r===0?a/n:a*r/-Math.expm1(-n*Math.log1p(r));balance=a;for(let i=1;i<=n;i++){const interest=balance*r,capital=i===n?balance:Math.min(balance,Math.max(0,payment-interest));balance=Math.max(0,balance-capital);total+=interest;rows.push([i,capital+interest,interest,capital,balance]);}return {payment,totalInterest:total,total:a+total,rows};}
 if(tool==='ahorro'){const a=number(d.principal),b=number(d.contribution),r=Math.expm1(Math.log1p(number(d.rate,-99.99,1000)/100)/12),n=period(d.months);balance=a;for(let i=1;i<=n;i++){const interest=balance*r;balance+=interest+b;number(balance,0,1e18);rows.push([i,b,interest,balance]);}return {balance,invested:a+n*b,gain:balance-a-n*b,monthly:r*100,rows};}
 if(tool==='depreciacion'){const a=number(d.cost),b=number(d.residual,0,a),n=period(d.years,100),annual=(a-b)/n;for(let i=1;i<=n;i++)rows.push([i,annual,annual*i,Math.max(b,a-annual*i)]);return {annual,monthly:annual/12,total:a-b,rows};}
 if(tool==='flujo'){balance=number(d.initial,-1e15);let totalIn=0,totalOut=0;if(!Array.isArray(d.rows)||d.rows.length<1||d.rows.length>120)throw Error('Agrega de 1 a 120 períodos.');d.rows.forEach((row,i)=>{const a=number(row[0]),b=number(row[1]);totalIn+=a;totalOut+=b;balance+=a-b;rows.push([i+1,a,b,a-b,balance]);});return {balance,totalIn,totalOut,net:totalIn-totalOut,rows};}
 if(tool==='van'||tool==='tir'){const a=number(d.initial,0.000001);if(!['anual','mensual'].includes(d.period)||!Array.isArray(d.rows)||!d.rows.length||d.rows.length>120)throw Error('Revisa los flujos y períodos.');d.rows.forEach(v=>number(v,tool==='tir'?0:-1e15));const npv=r=>d.rows.reduce((s,v,i)=>s+v/Math.pow(1+r,i+1),-a),sum=d.rows.reduce((s,v)=>s+v,0);if(tool==='van')return {value:npv(number(d.rate,-99.99,1000)/100),sum};if(sum<=0)throw Error('No hay una TIR calculable con estos flujos.');let lo=-.999999999,hi=Math.max(1,sum/a);for(let i=0;i<160;i++){const mid=(lo+hi)/2;if(npv(mid)>0)lo=mid;else hi=mid;}return {value:(lo+hi)/2*100,sum};}
 throw Error('Calculadora desconocida');
}
const api={compute};if(typeof module!=='undefined')module.exports=api;else root.CuadraMath=api;
})(globalThis);
