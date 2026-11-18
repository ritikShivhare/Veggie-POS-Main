/** Stored numbers include the business date so yesterday's 001 stays unique. */
export function orderBusinessDate(instant: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(instant));
}

export function displayOrderNumber(value: string): string {
  const number = value.replace(/^#/, '');
  return /^\d{4}-\d{2}-\d{2}\/\d{3,}$/.test(number)
    ? number.split('/')[1]
    : number;
}
