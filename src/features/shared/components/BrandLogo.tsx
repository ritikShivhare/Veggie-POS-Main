import React from "react";
import logo from "../../../assets/aatmyam-logo.webp";

export default function BrandLogo({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-lg bg-[#0D1D33] ${dark ? "ring-1 ring-white/10" : "ring-1 ring-black/5"}`}>
      {/* Frame the complete original artwork, removing only its empty outer
          margins. A shared viewBox keeps the symbol and wordmark in proportion
          at every size, without reconstructing the name in another font. */}
      <svg
        role="img"
        aria-label="Aatmyam POS — Restaurant Management"
        viewBox="110 300 1850 540"
        width="222"
        height="65"
        className="block w-[185px] h-[54px] sm:w-[222px] sm:h-[65px]"
      >
        <image href={logo} width="2048" height="1143" />
      </svg>
    </span>
  );
}
