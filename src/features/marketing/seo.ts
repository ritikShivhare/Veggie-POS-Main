import { renderSeoHead } from "../../../shared/marketing-seo";

/** Keep head metadata in sync after ordinary SPA navigation, without changing visible content. */
export function updateDocumentSeo(options: { privateView?: boolean } = {}) {
  const template = document.createElement("template");
  template.innerHTML = renderSeoHead(
    window.location.pathname + window.location.search,
    options,
  );
  document.head
    .querySelectorAll("[data-aatmyam-seo]")
    .forEach((node) => node.remove());
  document.head.append(template.content);
}
