"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

export default function Testimonials() {

  const testimonials = [
    {
      name: "James Rolle",
      role: "Business Owner",
      company: "Nassau Retail Group",
      quote:
        "Maltech VAT Pro dramatically simplified our VAT preparation process and reduced reporting time every month.",
    },

    {
      name: "Andrea Johnson",
      role: "Accountant",
      company: "Bahamas Financial Services",
      quote:
        "The audit-ready record system and QuickBooks integration make compliance management incredibly efficient.",
    },

    {
      name: "Michael Dean",
      role: "Operations Director",
      company: "Island Logistics Ltd.",
      quote:
        "The platform gives us confidence that our VAT records remain organized, secure, and accessible at all times.",
    },
  ];

  return (
    <section className="py-24 bg-white">

      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">

          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Trusted by Bahamian Businesses
          </h2>

          <p className="text-xl text-slate-600">
            See how organizations simplify VAT compliance with Maltech VAT Pro.
          </p>

        </div>

        <div className="grid lg:grid-cols-3 gap-8">

          {testimonials.map((testimonial, index) => (

            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-slate-50 rounded-3xl p-8 border hover:shadow-2xl hover:-translate-y-2 transition duration-300"
            >

              <div className="flex gap-1 mb-6">

                {[...Array(5)].map((_, i) => (

                  <Star
                    key={i}
                    className="w-5 h-5 fill-yellow-400 text-yellow-400"
                  />

                ))}

              </div>

              <p className="text-slate-600 text-lg leading-relaxed mb-8">

                "{testimonial.quote}"

              </p>

              <div className="flex items-center gap-4">

                <div className="w-14 h-14 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-xl">

                  {testimonial.name.charAt(0)}

                </div>

                <div>

                  <div className="font-semibold text-slate-900">
                    {testimonial.name}
                  </div>

                  <div className="text-slate-500 text-sm">
                    {testimonial.role}
                  </div>

                  <div className="text-cyan-700 text-sm font-medium">
                    {testimonial.company}
                  </div>

                </div>

              </div>

            </motion.div>

          ))}

        </div>

      </div>

    </section>
  );
}