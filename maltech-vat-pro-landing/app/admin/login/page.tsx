"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
    process.env.NODE_ENV === "development"
        ? "http://localhost:5000/api"
        : "https://api.maltechenterprises.com/api";

export default function AdminLoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.token) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Unable to sign in"
                );
            }

            localStorage.setItem("adminToken", data.token);
            localStorage.setItem(
                "adminUser",
                JSON.stringify(data.user)
            );

            router.push("/admin/leads");
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to sign in"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8">
                <h1 className="text-3xl font-bold mb-2">
                    Maltech Admin
                </h1>

                <p className="text-slate-500 mb-8">
                    Sign in to manage demo requests.
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
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            className="w-full border rounded-xl p-3"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Password
                        </label>

                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            className="w-full border rounded-xl p-3"
                        />
                    </div>

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
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </div>
        </main>
    );
}