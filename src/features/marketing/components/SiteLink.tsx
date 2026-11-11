import React from "react";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  onNavigate: () => void;
};

/** Real links for crawlers, direct visits and new tabs; ordinary clicks retain SPA navigation. */
export default function SiteLink({
  onNavigate,
  onClick,
  children,
  ...props
}: Props) {
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (event.currentTarget.target &&
            event.currentTarget.target !== "_self") ||
          event.currentTarget.hasAttribute("download")
        )
          return;
        event.preventDefault();
        onNavigate();
      }}
    >
      {children}
    </a>
  );
}
