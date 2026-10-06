"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
    process.env.NODE_ENV === "development"
        ? "http://localhost:5000/api"
        : "https://api.maltechenterprises.com/api";

export default function LeadsPage() {
    const router = useRouter();

    const [leads, setLeads] = useState<any[]>([]);
    const [selectedLead, setSelectedLead] = useState<any>(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState("");

    const getAdminToken = () => {
        if (typeof window === "undefined") {
            return null;
        }

        return localStorage.getItem("adminToken");
    };

    const clearAdminSession = () => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
    };

    const handleUnauthorized = () => {
        clearAdminSession();
        router.replace("/admin/login");
    };

    useEffect(() => {
        const token = getAdminToken();

        if (!token) {
            router.replace("/admin/login");
            return;
        }

        const loadLeads = async () => {
            try {
                const response = await fetch(
                    `${API_BASE}/leads`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (response.status === 401) {
                    handleUnauthorized();
                    return;
                }

                if (response.status === 403) {
                    setAccessError(
                        "System administrator access is required."
                    );
                    setLoading(false);
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        "Failed to load leads"
                    );
                }

                const data = await response.json();

                setLeads(
                    Array.isArray(data) ? data : []
                );
            } catch (error) {
                console.error(
                    "LEADS LOAD ERROR",
                    error
                );

                setAccessError(
                    "Unable to load the Lead Dashboard."
                );
            } finally {
                setLoading(false);
            }
        };

        loadLeads();
    }, [router]);

    const updateStatus = async (
        id: string,
        status: string
    ) => {
        const token = getAdminToken();

        if (!token) {
            handleUnauthorized();
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE}/leads/${id}/status`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        status,
                    }),
                }
            );

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                setAccessError(
                    "System administrator access is required."
                );
                return;
            }

            if (!response.ok) {
                throw new Error(
                    "Failed to update lead status"
                );
            }

            setLeads((prev) =>
                prev.map((lead) =>
                    lead.id === id
                        ? { ...lead, status }
                        : lead
                )
            );
        } catch (error) {
            console.error(
                "STATUS ERROR",
                error
            );
        }
    };

    const updateLeadField = async (
        id: string,
        field: string,
        value: string
    ) => {
        const token = getAdminToken();

        if (!token) {
            handleUnauthorized();
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE}/leads/${id}/notes`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        [field]: value,
                    }),
                }
            );

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                setAccessError(
                    "System administrator access is required."
                );
                return;
            }

            if (!response.ok) {
                throw new Error(
                    "Failed to update lead"
                );
            }

            setLeads((prev) =>
                prev.map((lead) =>
                    lead.id === id
                        ? {
                            ...lead,
                            [field]: value,
                        }
                        : lead
                )
            );
        } catch (error) {
            console.error(
                "LEAD UPDATE ERROR",
                error
            );
        }
    };

    const handleLogout = () => {
        clearAdminSession();
        router.replace("/admin/login");
    };

    const filteredLeads = leads.filter((lead) => {

        const searchText = search.toLowerCase();

        return (
            (lead.full_name || "")
                .toLowerCase()
                .includes(searchText) ||

            (lead.company_name || "")
                .toLowerCase()
                .includes(searchText) ||

            (lead.email || "")
                .toLowerCase()
                .includes(searchText) ||

            (lead.phone || "")
                .toLowerCase()
                .includes(searchText)
        );

    });

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-lg font-semibold text-slate-600">
                    Loading Lead Dashboard...
                </div>
            </div>
        );
    }

    if (accessError) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full">
                    <h1 className="text-2xl font-bold mb-4">
                        Access Denied
                    </h1>

                    <p className="text-slate-600 mb-6">
                        {accessError}
                    </p>

                    <button
                        onClick={handleLogout}
                        className="w-full bg-slate-900 text-white rounded-xl p-3 font-semibold"
                    >
                        Return to Admin Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-10">

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
                        Demo Requests
                    </h1>

                    <p className="text-slate-500 mt-1">
                        Lead Dashboard
                    </p>
                </div>

                <button
                    onClick={handleLogout}
                    className="bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold"
                >
                    Logout
                </button>
            </div>

            <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full mb-8 border rounded-2xl p-4"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">

                <div className="bg-white rounded-3xl shadow p-6">
                    <div className="text-sm text-slate-500">
                        Total Leads
                    </div>

                    <div className="text-4xl font-bold mt-2">
                        {leads.length}
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow p-6">
                    <div className="text-sm text-slate-500">
                        New Leads
                    </div>

                    <div className="text-4xl font-bold mt-2">
                        {
                            leads.filter(
                                (lead) => lead.status === "New"
                            ).length
                        }
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow p-6">
                    <div className="text-sm text-slate-500">
                        Contacted
                    </div>

                    <div className="text-4xl font-bold mt-2">
                        {
                            leads.filter(
                                (lead) => lead.status === "Contacted"
                            ).length
                        }
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow p-6">
                    <div className="text-sm text-slate-500">
                        Customers
                    </div>

                    <div className="text-4xl font-bold mt-2">
                        {
                            leads.filter(
                                (lead) => lead.status === "Customer"
                            ).length
                        }
                    </div>
                </div>

            </div>

            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

                <table className="w-full">

                    <thead className="bg-slate-100">

                        <tr>
                            <th className="p-4 text-left">Name</th>
                            <th className="p-4 text-left">Company</th>
                            <th className="p-4 text-left">Email</th>
                            <th className="p-4 text-left">Phone</th>
                            <th className="p-4 text-left">Status</th>
                            <th className="p-4 text-left">Notes</th>
                            <th className="p-4 text-left">Follow Up</th>
                            <th className="p-4 text-left">Date</th>
                        </tr>

                    </thead>

                    <tbody>

                        {filteredLeads.map((lead) => (

                            <tr
                                key={lead.id}
                                className="border-t"
                            >

                                <td className="p-4">
                                    <button
                                        onClick={() => setSelectedLead(lead)}
                                        className="text-blue-600 underline"
                                    >
                                        {lead.full_name}
                                    </button>
                                </td>

                                <td className="p-4">
                                    {lead.company_name}
                                </td>

                                <td className="p-4">
                                    {lead.email}
                                </td>

                                <td className="p-4">
                                    {lead.phone}
                                </td>

                                <td className="p-4">
                                    <select
                                        value={lead.status || "New"}
                                        onChange={(e) =>
                                            updateStatus(
                                                lead.id,
                                                e.target.value
                                            )
                                        }
                                        className="border rounded-lg p-2"
                                    >
                                        <option>New</option>
                                        <option>Contacted</option>
                                        <option>Demo Scheduled</option>
                                        <option>Proposal Sent</option>
                                        <option>Customer</option>
                                        <option>Lost</option>
                                    </select>
                                </td>
                                <td className="p-4">
                                    <textarea
                                        defaultValue={lead.notes || ""}
                                        onBlur={(e) =>
                                            updateLeadField(
                                                lead.id,
                                                "notes",
                                                e.target.value
                                            )
                                        }
                                        className="border rounded-lg p-2 w-full"
                                        rows={3}
                                    />
                                </td>
                                <td className="p-4">
                                    <input
                                        type="date"
                                        value={
                                            lead.next_followup
                                                ? lead.next_followup.slice(0, 10)
                                                : ""
                                        }
                                        onChange={(e) =>
                                            updateLeadField(
                                                lead.id,
                                                "next_followup",
                                                e.target.value
                                            )
                                        }
                                        className="border rounded-lg p-2"
                                    />
                                </td>

                                <td className="p-4">
                                    {new Date(
                                        lead.created_at
                                    ).toLocaleString()}
                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>

            {selectedLead && (

                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                >

                    <div className="bg-white p-8 rounded-2xl w-[900px] shadow-2xl">

                        <h2 className="text-2xl font-bold mb-6">
                            Lead Details
                        </h2>

                        <p>
                            <strong>Name:</strong>{" "}
                            {selectedLead.full_name}
                        </p>

                        <p>
                            <strong>Company:</strong>{" "}
                            {selectedLead.company_name}
                        </p>

                        <p>
                            <strong>Email:</strong>{" "}
                            {selectedLead.email}
                        </p>

                        <p>
                            <strong>Phone:</strong>{" "}
                            {selectedLead.phone}
                        </p>

                        <p>
                            <strong>Status:</strong>{" "}
                            {selectedLead.status}
                        </p>

                        <p>
                            <strong>Notes:</strong>{" "}
                            {selectedLead.notes}
                        </p>

                        <p>
                            <strong>Follow Up:</strong>{" "}
                            {selectedLead.next_followup
                                ? new Date(
                                    selectedLead.next_followup
                                ).toLocaleDateString()
                                : "Not Scheduled"}
                        </p>

                        <button
                            onClick={() => setSelectedLead(null)}
                            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg"
                        >
                            Close
                        </button>

                    </div>

                </div>

            )}

        </div>
    );
}