/** Decimal arithmetic at the currency/stock boundary. No binary float tie rules. */
function fraction(value:number):[bigint,bigint] {
 if(!Number.isFinite(value))throw new Error('A finite decimal is required.');
 const [coefficient,exponent='0']=String(value).toLowerCase().split('e');
 const [whole,part='']=coefficient.split('.');const scale=part.length-Number(exponent);
 const n=BigInt(whole+part);return scale>=0?[n,10n**BigInt(scale)]:[n*10n**BigInt(-scale),1n];
}
function rounded(n:bigint,d:bigint,places:number):number {
 if(d===0n)throw new Error('Cannot divide by zero.');
 const sign=(n<0n)!==(d<0n)?-1:1;n=n<0n?-n:n;d=d<0n?-d:d;
 const scale=10n**BigInt(places),scaled=n*scale;
 return sign*Number((scaled+d/2n)/d)/Number(scale);
}
export function decimalRound(value:number,places=2) {const [n,d]=fraction(value);return rounded(n,d,places);}
export function decimalMultiply(a:number,b:number,places=2) {const [an,ad]=fraction(a),[bn,bd]=fraction(b);return rounded(an*bn,ad*bd,places);}
export function decimalDivide(a:number,b:number,places=10) {const [an,ad]=fraction(a),[bn,bd]=fraction(b);return rounded(an*bd,ad*bn,places);}
export function percentOf(amount:number,percent:number) {const [an,ad]=fraction(amount),[pn,pd]=fraction(percent);return rounded(an*pn,ad*pd*100n,2);}
export const money=(value:number)=>decimalRound(value,2);
export const quantity=(value:number)=>decimalRound(value,9);
export const sumMoney=(values:number[])=>Number(values.reduce((sum,v)=>sum+BigInt(Math.round(money(v)*100)),0n))/100;
export function isCurrency(value:number) {return Number.isFinite(value)&&money(value)===value;}
