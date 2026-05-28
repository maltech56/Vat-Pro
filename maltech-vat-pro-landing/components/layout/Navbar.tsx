"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export default function Navbar() {

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };

  }, []);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300
  ${scrolled
          ? "bg-white/80 backdrop-blur-xl shadow-lg border-b"
          : "bg-transparent"
        }`}
    >
      <div className="max-w-7xl mx-auto h-20 flex items-center justify-between px-6">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-600"></div>

          <div>
            <h1 className="font-bold text-xl text-slate-900">
              Maltech VAT Pro
            </h1>

            <p className="text-xs text-slate-500">
              VAT Compliance Platform
            </p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-slate-700">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-slate-900"
        >

          {mobileOpen ? (
            <X className="w-8 h-8" />
          ) : (
            <Menu className="w-8 h-8" />
          )}

        </button>

        <button className="hidden md:block bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-3 rounded-xl transition">
          Start Free Trial
        </button>
      </div>
      {mobileOpen && (

        <div className="md:hidden bg-white border-t shadow-lg">

          <div className="flex flex-col p-6 gap-6 text-slate-700">

            <a
              href="#features"
              onClick={() => setMobileOpen(false)}
            >
              Features
            </a>

            <a
              href="#pricing"
              onClick={() => setMobileOpen(false)}
            >
              Pricing
            </a>

            <a
              href="#faq"
              onClick={() => setMobileOpen(false)}
            >
              FAQ
            </a>

            <button className="bg-cyan-600 text-white py-3 rounded-xl">

              Start Free Trial

            </button>

          </div>

        </div>

      )}
    </header>
  );
}