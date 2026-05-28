"use client";

import { useState } from "react";

export default function Contact() {

  const [submitted, setSubmitted] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {

    e.preventDefault();

    setLoading(true);

    try {

      const formData = new FormData(e.currentTarget);

      const response = await fetch(
        "http://localhost:5000/api/demo/demo-request",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            fullName: formData.get("fullName"),
            companyName: formData.get("companyName"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            message: formData.get("message"),
          }),
        }
      );

      const data = await response.json();

      if (data.success) {

        setSubmitted(true);

      } else {

        alert(data.message || "Submission failed");

      }

    } catch (error) {

      console.error(error);

      alert("Something went wrong");

    } finally {

      setLoading(false);

    }
  };

  return (
    <section className="py-24 bg-cyan-50">

      <div className="max-w-4xl mx-auto px-6">

        <div className="text-center mb-16">

          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Book a Demo
          </h2>

          <p className="text-xl text-slate-600">
            Speak with our team and see how Maltech VAT Pro simplifies VAT compliance.
          </p>

        </div>

        <div className="bg-white rounded-3xl shadow-2xl border p-10">

          {submitted ? (

            <div className="text-center py-10">

              <div className="text-4xl mb-4">
                ✅
              </div>

              <h3 className="text-3xl font-bold text-slate-900 mb-4">
                Demo Request Submitted
              </h3>

              <p className="text-slate-600 text-lg">
                Our team will contact you shortly.
              </p>

            </div>

          ) : (

            <form
              onSubmit={handleSubmit}
              className="space-y-8"
            >

              <div className="grid md:grid-cols-2 gap-6">

                <div>

                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Full Name
                  </label>

                  <input
                    type="text"
                    name="fullName"
                    required
                    className="w-full border border-slate-300 rounded-2xl px-5 py-4 outline-none focus:border-cyan-600"
                    placeholder="John Smith"
                  />

                </div>

                <div>

                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Company Name
                  </label>

                  <input
                    type="text"
                    name="companyName"
                    required
                    className="w-full border border-slate-300 rounded-2xl px-5 py-4 outline-none focus:border-cyan-600"
                    placeholder="ABC Company Ltd."
                  />

                </div>

              </div>

              <div className="grid md:grid-cols-2 gap-6">

                <div>

                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email Address
                  </label>

                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full border border-slate-300 rounded-2xl px-5 py-4 outline-none focus:border-cyan-600"
                    placeholder="john@example.com"
                  />

                </div>

                <div>

                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone Number
                  </label>

                  <input
                    type="tel"
                    name="phone"
                    className="w-full border border-slate-300 rounded-2xl px-5 py-4 outline-none focus:border-cyan-600"
                    placeholder="+1 (242) 000-0000"
                  />

                </div>

              </div>

              <div>

                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Message
                </label>

                <textarea
                  name="message"
                  rows={5}
                  className="w-full border border-slate-300 rounded-2xl px-5 py-4 outline-none focus:border-cyan-600"
                  placeholder="Tell us about your VAT compliance needs..."
                ></textarea>

              </div>

              <button
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-5 rounded-2xl font-semibold text-lg transition"
              >

                {loading ? "Submitting..." : "Request Demo"}

              </button>

            </form>

          )}

        </div>

      </div>

    </section>
  );
}