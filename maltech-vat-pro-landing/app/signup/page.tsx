"use client";

import { useEffect } from "react";

export default function SignupPage() {
  useEffect(() => {
    window.location.href =
      "https://vat-pro-frontend.onrender.com/register";
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-6 py-24 text-center">
      <h1 className="text-5xl font-bold mb-6">
        Redirecting to VAT Pro Registration...
      </h1>

      <p>
        If you are not redirected automatically,
        click the button below.
      </p>

      <a
        href="https://vat-pro-frontend.onrender.com/register"
        className="inline-block mt-8 bg-cyan-600 text-white px-8 py-4 rounded-xl"
      >
        Continue
      </a>
    </main>
  );
}