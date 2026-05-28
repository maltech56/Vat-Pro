"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FAQ() {

  const faqs = [
    {
      question: "Is Maltech VAT Pro compliant with Bahamian VAT regulations?",
      answer:
        "Yes. Maltech VAT Pro is designed specifically for Bahamian VAT workflows and reporting requirements.",
    },

    {
      question: "Can I integrate QuickBooks with the platform?",
      answer:
        "Yes. The platform supports QuickBooks integration along with Excel, CSV, and PDF imports.",
    },

    {
      question: "Is my financial data secure?",
      answer:
        "Yes. We use secure cloud infrastructure, encrypted storage, and access controls to protect your data.",
    },

    {
      question: "Can accountants manage multiple companies?",
      answer:
        "Yes. Professional and Enterprise plans support multi-company management.",
    },

    {
      question: "Does the platform maintain audit-ready records?",
      answer:
        "Absolutely. The system stores organized digital records and transaction histories for audit readiness.",
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      className="py-24 bg-cyan-50"
    >

      <div className="max-w-4xl mx-auto px-6">

        <div className="text-center mb-16">

          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>

          <p className="text-xl text-slate-600">
            Everything you need to know about Maltech VAT Pro.
          </p>

        </div>

        <div className="space-y-6">

          {faqs.map((faq, index) => {

            const isOpen = openIndex === index;

            return (

              <div
                key={index}
                className="bg-white rounded-3xl border shadow-sm overflow-hidden"
              >

                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-8 text-left"
                >

                  <span className="text-xl font-semibold text-slate-900">
                    {faq.question}
                  </span>

                  <ChevronDown
                    className={`w-6 h-6 text-cyan-700 transition-transform duration-300
                    ${isOpen ? "rotate-180" : ""}
                    `}
                  />

                </button>

                {isOpen && (

                  <div className="px-8 pb-8 text-slate-600 leading-relaxed text-lg">

                    {faq.answer}

                  </div>

                )}

              </div>
            );
          })}

        </div>

      </div>
    </section>
  );
}