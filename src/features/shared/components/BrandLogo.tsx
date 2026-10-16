import React from "react";
import logo from "../../../assets/aatmyam-logo.webp";

export default function BrandLogo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 shrink-0">
      <span aria-hidden="true" className="relative block w-11 h-11 overflow-hidden rounded-xl bg-[#0D1D33] shrink-0">
        <img src={logo} alt="" width={2048} height={1143}
          className="absolute max-w-none w-[160px] h-auto -left-[10px] -top-[23px]" />
      </span>
      <span className="flex flex-col text-left">
        <span className={`font-serif text-lg tracking-tight font-bold ${dark ? "text-[#FBF9F5]" : "text-[#181A18]"}`}>
          Aatmyam POS
        </span>
        <span className={`text-[9px] uppercase tracking-wider font-mono ${dark ? "text-[#A6AEA0]" : "text-[#787F74]"}`}>
          Restaurant Management
        </span>
      </span>
    </span>
  );
}
