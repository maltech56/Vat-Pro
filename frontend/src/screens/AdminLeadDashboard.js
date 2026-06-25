import React, { useEffect, useState } from "react";

export default function AdminLeadDashboard() {
    const [leads, setLeads] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedLead, setSelectedLead] = useState(null);

    import { API_BASE } from "../api/config";

    const updateLeadField = async (
        id,
        field,
        value
    ) => {

        try {

            await fetch(
                `${API_BASE}/leads/${id}/notes`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        [field]: value,
                    }),
                }
            );

            loadLeads();

        } catch (error) {

            console.error(error);

        }

    };

    const updateStatus = async (
        id,
        status
    ) => {

        console.log(
            "STATUS CHANGE CLICKED",
            id,
            status
        );

        try {

            await fetch(
                `${API_BASE}/leads/${id}/notes`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        [field]: value,
                    }),
                }
            );

            loadLeads();

        } catch (error) {

            console.error(error);

        }

    };

    const loadLeads = () => {
        fetch(`${API_BASE}/leads`)
            .then((res) => res.json())
            .then((data) => setLeads(data))
            .catch(console.error);
    };

    useEffect(() => {
        loadLeads();
    }, []);

    return (
        <div style={{ padding: "30px" }}>
            <h1>Lead Dashboard</h1>

            {/* PASTE SEARCH BOX HERE */}

            <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) =>
                    setSearch(e.target.value)
                }
                style={{
                    marginBottom: "20px",
                    padding: "10px",
                    width: "400px",
                }}
            />

            <table border="1" cellPadding="10">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Notes</th>
                        <th>Follow Up</th>
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
                            <tr
                                key={lead.id}
                                onClick={() => {
                                    console.log("ROW CLICKED");
                                    setSelectedLead(lead);
                                }}
                                style={{
                                    cursor: "pointer"
                                }}
                            >
                                <td>{lead.full_name}</td>
                                <td>{lead.company_name}</td>
                                <td>{lead.email}</td>
                                <td>{lead.phone}</td>

                                <td>
                                    <select
                                        value={lead.status || "New"}
                                        onChange={(e) =>
                                            updateStatus(
                                                lead.id,
                                                e.target.value
                                            )
                                        }
                                    >
                                        <option>New</option>
                                        <option>Contacted</option>
                                        <option>Qualified</option>
                                        <option>Proposal Sent</option>
                                        <option>Customer</option>
                                        <option>Lost</option>
                                    </select>
                                </td>

                                <td>
                                    <textarea
                                        value={lead.notes || ""}
                                        onChange={(e) =>
                                            updateLeadField(
                                                lead.id,
                                                "notes",
                                                e.target.value
                                            )
                                        }
                                        rows="3"
                                        cols="25"
                                    />
                                </td>

                                <td>
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
                                    />
                                </td>

                                <td>
                                    {new Date(
                                        lead.created_at
                                    ).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>

            {selectedLead && (

                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 9999
                    }}
                >

                    <div
                        style={{
                            background: "white",
                            padding: "30px",
                            width: "700px",
                            borderRadius: "12px",
                            maxHeight: "90vh",
                            overflowY: "auto"
                        }}
                    >

                        <h2>
                            Lead Details
                        </h2>

                        <hr />

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
                            {selectedLead.next_followup}
                        </p>

                        <p>
                            <strong>Created:</strong>{" "}
                            {new Date(
                                selectedLead.created_at
                            ).toLocaleString()}
                        </p>

                        <button
                            onClick={() => {
                                alert("ROW CLICKED");
                                setSelectedLead(lead);
                            }}
                        >
                            Close
                        </button>

                    </div>

                </div>

            )}

        </div>
    );
}