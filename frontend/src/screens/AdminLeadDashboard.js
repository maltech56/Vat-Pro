import React, { useEffect, useState } from "react";

export default function AdminLeadDashboard() {
    const [leads, setLeads] = useState([]);
    const [search, setSearch] = useState("");


    useEffect(() => {
        fetch("http://localhost:5000/api/leads")
            .then((res) => res.json())
            .then((data) => setLeads(data))
            .catch(console.error);
    }, []);

    return (
        <div style={{ padding: "30px" }}>
            <h1>Lead Dashboard</h1>

            <table border="1" cellPadding="10">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Date</th>
                    </tr>
                </thead>

                <tbody>
                    {leads
                        .filter((lead) =>
                            (
                                lead.full_name +
                                lead.company_name +
                                lead.email
                            )
                                .toLowerCase()
                                .includes(search.toLowerCase())
                        )
                        .map((lead) => (
                            <tr key={lead.id}>
                                <td>{lead.full_name}</td>
                                <td>{lead.company_name}</td>
                                <td>{lead.email}</td>
                                <td>{lead.phone}</td>

                                <td>{lead.status || "New"}</td>

                                <td>
                                    {new Date(
                                        lead.created_at
                                    ).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}