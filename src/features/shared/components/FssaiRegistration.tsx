import React from "react";

/** Format validation only; this does not verify registration with the authority. */
export const isFssaiNumber = (value: string) => /^\d{14}$/.test(value.trim());

export default function FssaiRegistration({ number, className = "text-[10px] text-slate-500 mt-1" }: { number?: string; className?: string }) {
  if (!number || !isFssaiNumber(number)) return null;
  return <p className={className}>FSSAI: {number.trim()}</p>;
}
