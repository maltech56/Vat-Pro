"use client";

import { useState } from "react";

const API_BASE =
    process.env.NODE_ENV === "development"
        ? "http://localhost:5000/api"
        : "https://api.maltechenterprises.com/api";

export default function ConsultationRequestPage() {
    const [fullName, setFullName] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [message, setMessage] = useState("");

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setLoading(true);

            const response = await fetch(
                `${API_BASE}/demo/demo-request`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        fullName,
                        companyName,
                        email,
                        phone,
                        message,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Submission failed"
                );
            }

            setSuccess(
                "Your consultation request has been submitted successfully."
            );

            setFullName("");
            setCompanyName("");
            setEmail("");
            setPhone("");
            setMessage("");

        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="max-w-4xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold mb-6">
                Schedule a Consultation
            </h1>

            <p className="text-lg text-slate-600 mb-8">
                Meet with a VAT compliance specialist to discuss your business requirements.
            </p>

            <form
                onSubmit={submitForm}
                className="bg-white border rounded-2xl p-8 space-y-4"
            >
                <input
                    className="w-full border rounded-lg p-3"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) =>
                        setFullName(e.target.value)
                    }
                    required
                />

                <input
                    className="w-full border rounded-lg p-3"
                    placeholder="Company Name"
                    value={companyName}
                    onChange={(e) =>
                        setCompanyName(e.target.value)
                    }
                    required
                />

                <input
                    className="w-full border rounded-lg p-3"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) =>
                        setEmail(e.target.value)
                    }
                    required
                />

                <input
                    className="w-full border rounded-lg p-3"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) =>
                        setPhone(e.target.value)
                    }
                />

                <textarea
                    className="w-full border rounded-lg p-3"
                    placeholder="Tell us about your business and VAT requirements"
                    rows={5}
                    value={message}
                    onChange={(e) =>
                        setMessage(e.target.value)
                    }
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-xl"
                >
                    {loading
                        ? "Submitting..."
                        : "Request Consultation"}
                </button>

                {success && (
                    <div className="mt-6 space-y-4">

                        <p className="text-green-600 font-medium">
                            {success}
                        </p>

                        <p className="text-slate-600">
                            While you wait for our VAT specialist to contact you,
                            you can start your free 14-day trial today.
                        </p>

                        <a
                            href="https://vat-pro-frontend.onrender.com/register"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-xl font-medium"
                        >
                            Start Free Trial
                        </a>

                    </div>
                )}
            </form>
        </main>
    );
}