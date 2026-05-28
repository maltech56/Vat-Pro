"use client";

import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Hero() {
    return (
        <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="pt-40 pb-24 bg-gradient-to-b from-cyan-50 via-white to-cyan-100 overflow-hidden"
        >

            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">

                <motion.div
                    initial={{ opacity: 0, x: -60 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                >

                    <div className="inline-flex items-center gap-2 bg-cyan-100 text-cyan-700 px-4 py-2 rounded-full mb-6">
                        🇧🇸 Built for Bahamian Businesses
                    </div>

                    <h1 className="text-5xl lg:text-6xl font-bold leading-tight text-slate-900 mb-6">
                        Modern VAT Compliance for Bahamian Businesses
                    </h1>

                    <p className="text-xl text-slate-600 leading-relaxed mb-8">
                        Prepare VAT returns, automate calculations, manage audit-ready
                        records, and connect your accounting systems in one secure platform.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-7 py-4 rounded-2xl font-semibold">
                            Start Free Trial
                        </button>

                        <button className="border border-slate-300 hover:border-slate-500 px-7 py-4 rounded-2xl font-semibold">
                            Book a Demo
                        </button>
                    </div>
                    <div className="mt-10 flex flex-wrap gap-8 text-sm text-slate-600">

                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-cyan-600" />
                            <span>Secure Cloud Platform</span>
                        </div>

                        <div>
                            ✓ Built for Bahamas VAT
                        </div>

                        <div>
                            ✓ 14-Day Free Trial
                        </div>

                    </div>
                </motion.div>

                <div className="relative">

                    <div className="bg-white rounded-3xl shadow-2xl border p-8">

                        <img
                            src="/dashboard-preview.png"
                            alt="Maltech VAT Pro Dashboard"
                            className="rounded-2xl shadow-2xl border"
                        />
                        
                    </div>
                </div>
            </div>
        </motion.section >
    );
}