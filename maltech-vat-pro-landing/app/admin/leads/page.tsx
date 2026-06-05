"use client";

const API_BASE =
    process.env.NODE_ENV === "development"
        ? "http://localhost:5000/api"
        : "https://api.maltechenterprises.com/api";

import { useEffect, useState } from "react";

export default function LeadsPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [selectedLead, setSelectedLead] = useState<any>(null);

    useEffect(() => {
        fetch(`${API_BASE}/leads`)
            .then((res) => res.json())
            .then((data) => setLeads(data))
            .catch(console.error);
    }, []);

    const [search, setSearch] = useState("");

    const updateStatus = async (
        id: string,
        status: string
    ) => {

        console.log(
            "STATUS CHANGE CLICKED",
            id,
            status
        );

        try {

            const response = await fetch(
                `${API_BASE}/leads/${id}/status`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status,
                    }),
                }
            );

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

        try {

            await fetch(
                `${API_BASE}/leads/${id}/notes`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        [field]: value,
                    }),
                }
            );

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

            console.error(error);

        }

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

    return (
        <div className="min-h-screen bg-slate-50 p-10">

            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-8">
                Demo Requests
            </h1>

            <h1>Lead Dashboard</h1>

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