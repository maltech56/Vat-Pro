"use client";

import { motion } from "framer-motion";

export default function Stats() {

  const stats = [
    {
      number: "500+",
      label: "Businesses Supported",
    },

    {
      number: "99.9%",
      label: "Secure Cloud Uptime",
    },

    {
      number: "10K+",
      label: "VAT Transactions Processed",
    },

    {
      number: "24/7",
      label: "Audit Ready Access",
    },
  ];

  return (
    <section className="py-24 bg-slate-950 text-white">

      <div className="max-w-7xl mx-auto px-6">

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">

          {stats.map((stat, index) => (

            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center"
            >

              <div className="text-5xl font-bold text-cyan-400 mb-4">

                {stat.number}

              </div>

              <div className="text-slate-300 text-xl">

                {stat.label}

              </div>

            </motion.div>

          ))}

        </div>

      </div>

    </section>
  );
}