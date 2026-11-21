import {decimalDivide,decimalMultiply,decimalRound,quantity} from './decimal';
export function purchaseTotals(stock:number,rate:number,received:number,cost:number) {
 if(![stock,rate,received,cost].every(Number.isFinite)||stock<0||rate<0||received<=0||cost<0)throw new Error('Invalid inventory purchase.');
 const currentStock=quantity(stock+received);
 return {currentStock,costPerUnit:decimalDivide(decimalRound(decimalMultiply(stock,rate,12)+cost,12),currentStock,12)};
}
