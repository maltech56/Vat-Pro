"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const API_BASE =
    process.env.NODE_ENV === "development"
        ? "http://localhost:5000/api"
        : "https://api.maltechenterprises.com/api";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        setMessage("");
        setError("");
        setLoading(true);

        try {
            const response = await fetch(
                `${API_BASE}/auth/forgot-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    data.message ||
                    "Unable to process password reset"
                );
            }

            setMessage(
                data.message ||
                "If an account exists for that email address, a password reset link has been sent."
            );

            setEmail("");
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to process password reset"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8">
                <h1 className="text-3xl font-bold mb-2">
                    Reset Password
                </h1>

                <p className="text-slate-500 mb-8">
                    Enter your Maltech Admin email address.
                    If an account exists, we will send you
                    a password reset link.
                </p>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Email
                        </label>

                        <input
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            className="w-full border rounded-xl p-3"
                        />
                    </div>

                    {message && (
                        <div className="text-green-700 text-sm">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white rounded-xl p-3 font-semibold disabled:opacity-50"
                    >
                        {loading
                            ? "Sending..."
                            : "Send Reset Link"}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link
                        href="/admin/login"
                        className="text-blue-600 hover:underline text-sm"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </main>
    );
}