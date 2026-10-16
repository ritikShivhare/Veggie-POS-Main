import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import FssaiRegistration from "../src/features/shared/components/FssaiRegistration";

it.each([undefined, "", "   ", "123", "1234567890123x"])("omits absent or malformed FSSAI number %s", (number) => {
  expect(renderToStaticMarkup(<FssaiRegistration number={number} />)).toBe("");
});

it("prints only the configured restaurant number, with surrounding whitespace removed", () => {
  const html = renderToStaticMarkup(<FssaiRegistration number=" 12345678901234 " />);
  expect(html.replace(/<[^>]+>/g, "")).toBe("FSSAI: 12345678901234");
  expect(html).not.toContain("10020011000123");
});
