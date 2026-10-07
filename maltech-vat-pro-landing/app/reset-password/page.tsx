"use client";

import {
    FormEvent,
    Suspense,
    useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API_BASE =
    process.env.NODE_ENV === "development"
        ? "http://localhost:5000/api"
        : "https://api.maltechenterprises.com/api";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] =
        useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [completed, setCompleted] = useState(false);

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        setMessage("");
        setError("");

        if (!token) {
            setError(
                "This password reset link is invalid."
            );
            return;
        }

        if (newPassword.length < 8) {
            setError(
                "Password must be at least 8 characters."
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(
                "The passwords do not match."
            );
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_BASE}/auth/reset-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        token,
                        newPassword,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    data.message ||
                    "Unable to reset password"
                );
            }

            setMessage(
                data.message ||
                "Password reset successfully."
            );

            setCompleted(true);
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to reset password"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-2">
                Create New Password
            </h1>

            <p className="text-slate-500 mb-8">
                Enter a new password for your
                Maltech VAT Pro account.
            </p>

            {!token && (
                <div className="text-red-600 text-sm mb-6">
                    This password reset link is
                    invalid or incomplete.
                </div>
            )}

            {!completed && token && (
                <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            New Password
                        </label>

                        <input
                            type="password"
                            required
                            minLength={8}
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(event) =>
                                setNewPassword(
                                    event.target.value
                                )
                            }
                            className="w-full border rounded-xl p-3"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Confirm Password
                        </label>

                        <input
                            type="password"
                            required
                            minLength={8}
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(event) =>
                                setConfirmPassword(
                                    event.target.value
                                )
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
                        {loading
                            ? "Resetting..."
                            : "Reset Password"}
                    </button>
                </form>
            )}

            {message && (
                <div className="text-green-700 text-sm mb-6">
                    {message}
                </div>
            )}

            <div className="mt-6 text-center">
                <Link
                    href="/admin/login"
                    className="text-blue-600 hover:underline text-sm"
                >
                    Back to Sign In
                </Link>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <Suspense
                fallback={
                    <div className="text-slate-500">
                        Loading password reset...
                    </div>
                }
            >
                <ResetPasswordForm />
            </Suspense>
        </main>
    );
}