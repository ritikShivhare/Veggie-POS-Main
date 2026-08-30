import React, { useState, useEffect } from "react";
import { MarketingRoute } from "./types";
import MarketingNav from "./components/MarketingNav";
import MarketingFooter from "./components/MarketingFooter";
import HomePage from "./pages/HomePage";
import ProductPage from "./pages/ProductPage";
import SolutionsPage from "./pages/SolutionsPage";
import RoiPage from "./pages/RoiPage";
import PricingPage from "./pages/PricingPage";
import AboutPage from "./pages/AboutPage";
import ResourcesPage from "./pages/ResourcesPage";
import ContactPage from "./pages/ContactPage";

interface MarketingAppProps {
  initialRoute?: MarketingRoute;
  onOpenLogin: () => void;
  onOpenLegal: (page: "terms" | "privacy" | "refund-policy") => void;
  onOpenSignup: () => void;
}

export default function MarketingApp({
  initialRoute = "/",
  onOpenLogin,
  onOpenLegal,
  onOpenSignup
}: MarketingAppProps) {
  const [currentRoute, setCurrentRoute] = useState<MarketingRoute>(() => {
    const path = window.location.pathname;
    const validRoutes: MarketingRoute[] = [
      "/",
      "/product",
      "/solutions",
      "/roi",
      "/pricing",
      "/about",
      "/resources",
      "/contact"
    ];
    return validRoutes.includes(path as MarketingRoute) ? (path as MarketingRoute) : initialRoute;
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname as MarketingRoute;
      const validRoutes: MarketingRoute[] = [
        "/",
        "/product",
        "/solutions",
        "/roi",
        "/pricing",
        "/about",
        "/resources",
        "/contact"
      ];
      if (validRoutes.includes(path)) {
        setCurrentRoute(path);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleNavigate = (route: MarketingRoute) => {
    setCurrentRoute(route);
    window.history.pushState({}, "", route);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderActivePage = () => {
    switch (currentRoute) {
      case "/product":
        return <ProductPage onNavigate={handleNavigate} />;
      case "/solutions":
        return <SolutionsPage onNavigate={handleNavigate} />;
      case "/roi":
        return <RoiPage onNavigate={handleNavigate} />;
      case "/pricing":
        return <PricingPage onNavigate={handleNavigate} />;
      case "/about":
        return <AboutPage onNavigate={handleNavigate} />;
      case "/resources":
        return <ResourcesPage onNavigate={handleNavigate} />;
      case "/contact":
        return <ContactPage onNavigate={handleNavigate} />;
      case "/":
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1C1E1B] flex flex-col font-sans selection:bg-[#6E8F45]/20 selection:text-[#1C1E1B]">
      {/* Top Navigation */}
      <MarketingNav
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        onOpenLogin={onOpenLogin}
      />

      {/* Main Content Render */}
      <main className="flex-1">
        {renderActivePage()}
      </main>

      {/* Footer */}
      <MarketingFooter
        onNavigate={handleNavigate}
        onOpenLogin={onOpenLogin}
        onOpenLegal={onOpenLegal}
      />
    </div>
  );
}
