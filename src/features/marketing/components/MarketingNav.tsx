import React, { useState, useEffect } from "react";
import { MarketingRoute } from "../types";
import {
  Menu,
  X,
  ArrowRight,
  Sparkles,
  Terminal,
  ShieldCheck,
  ChevronRight
} from "lucide-react";

interface MarketingNavProps {
  currentRoute: MarketingRoute;
  onNavigate: (route: MarketingRoute) => void;
  onOpenLogin: () => void;
}

export default function MarketingNav({
  currentRoute,
  onNavigate,
  onOpenLogin
}: MarketingNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks: { label: string; route: MarketingRoute }[] = [
    { label: "Product", route: "/product" },
    { label: "Solutions", route: "/solutions" },
    { label: "ROI Calculator", route: "/roi" },
    { label: "Pricing", route: "/pricing" },
    { label: "About", route: "/about" },
    { label: "Resources", route: "/resources" }
  ];

  const handleLinkClick = (route: MarketingRoute) => {
    onNavigate(route);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-[#FBF9F5]/95 backdrop-blur-md border-b border-[#EAE5DA] shadow-xs"
          : "bg-[#FBF9F5] border-b border-[#F0EBE1]"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <button
            onClick={() => handleLinkClick("/")}
            className="flex items-center gap-2.5 group text-left cursor-pointer focus:outline-hidden"
            id="brand-home-link"
          >
            <div className="w-8 h-8 rounded-lg bg-[#181A18] text-[#FBF9F5] flex items-center justify-center font-serif text-lg font-bold border border-[#2E332D] shadow-xs group-hover:bg-[#6E8F45] transition-colors duration-200">
              V
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg tracking-tight font-bold text-[#181A18] flex items-center gap-1.5">
                Veggie POS
                <span className="w-1.5 h-1.5 rounded-full bg-[#6E8F45]"></span>
              </span>
              <span className="text-[10px] uppercase tracking-wider font-mono text-[#787F74]">
                Hospitality Command
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#F4F0E8] px-3 py-1.5 rounded-full border border-[#EAE5DA]">
            {navLinks.map((link) => {
              const isActive = currentRoute === link.route;
              return (
                <button
                  key={link.route}
                  onClick={() => handleLinkClick(link.route)}
                  id={`nav-link-${link.route.replace("/", "") || "home"}`}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-[#181A18] text-[#FBF9F5] shadow-xs"
                      : "text-[#5A6056] hover:text-[#181A18] hover:bg-[#EAE5DA]/60"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={onOpenLogin}
              id="nav-signin-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#181A18] hover:text-[#6E8F45] bg-[#F4F0E8] hover:bg-[#EAE5DA] rounded-xl transition-all duration-150 border border-[#EAE5DA] cursor-pointer"
            >
              <span>Sign In</span>
            </button>

            <button
              onClick={() => handleLinkClick("/contact")}
              id="nav-book-demo-btn"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer border border-[#2E332D]"
            >
              <span>Book Walkthrough</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={onOpenLogin}
              className="sm:hidden inline-flex items-center px-3 py-1.5 text-xs font-bold text-[#181A18] bg-[#F4F0E8] rounded-lg border border-[#EAE5DA]"
            >
              <span>Sign In</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl bg-[#F4F0E8] text-[#181A18] border border-[#EAE5DA] hover:bg-[#EAE5DA] transition cursor-pointer"
              aria-label="Toggle navigation menu"
              id="mobile-nav-toggle-btn"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#FBF9F5] border-b border-[#EAE5DA] px-4 pt-3 pb-6 space-y-2 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const isActive = currentRoute === link.route;
              return (
                <button
                  key={link.route}
                  onClick={() => handleLinkClick(link.route)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl text-left transition ${
                    isActive
                      ? "bg-[#181A18] text-[#FBF9F5]"
                      : "text-[#181A18] hover:bg-[#F4F0E8]"
                  }`}
                >
                  <span>{link.label}</span>
                  <ChevronRight className="w-4 h-4 opacity-60" />
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#EAE5DA] space-y-2.5">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenLogin();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-[#181A18] bg-[#F4F0E8] rounded-xl border border-[#EAE5DA]"
            >
              <span>Sign In / Store Portal</span>
            </button>

            <button
              onClick={() => handleLinkClick("/contact")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-[#FBF9F5] bg-[#181A18] rounded-xl border border-[#2E332D]"
            >
              <span>Book a 15-Min Walkthrough</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
