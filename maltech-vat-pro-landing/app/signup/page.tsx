import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 text-center">
      <h1 className="text-5xl font-bold mb-6">
        Start Your Free Trial
      </h1>

      <p className="text-xl text-slate-600 mb-10">
        Get full access to Maltech VAT Pro for 14 days.
      </p>

      <Link
        href="https://vat-pro-frontend.onrender.com/register"
        className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-4 rounded-xl text-lg font-semibold"
      >
        Start Free Trial
      </Link>
    </main>
  );
}