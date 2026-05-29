"use client";

import { useEffect, useState } from "react";

export default function LeadsPage() {
    const [leads, setLeads] = useState<any[]>([]);

    useEffect(() => {
        fetch("http://localhost:5000/api/leads")
            .then((res) => res.json())
            .then((data) => setLeads(data))
            .catch(console.error);
    }, []);

    const [search, setSearch] = useState("");

    return (
        <div className="min-h-screen bg-slate-50 p-10">

            <h1 className="text-4xl font-bold mb-8">
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
            <div className="grid md:grid-cols-4 gap-6 mb-10">

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
                            <th className="p-4 text-left">Date</th>
                        </tr>

                    </thead>

                    <tbody>

                        {leads.map((lead) => (

                            <tr
                                key={lead.id}
                                className="border-t"
                            >

                                <td className="p-4">
                                    {lead.full_name}
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
                                    <span className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full">
                                        {lead.status || "New"}
                                    </span>
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

        </div>
    );
}