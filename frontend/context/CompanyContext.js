import React, { createContext, useContext, useEffect, useState } from "react";
import { getToken } from "../src/utils/session";

const CompanyContext = createContext();

export const CompanyProvider = ({ children }) => {
  const [selectedCompany, setSelectedCompanyState] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyReady, setCompanyReady] = useState(false);

  useEffect(() => {
    const loadSelectedCompany = () => {
      try {
        if (typeof localStorage === "undefined") {
          setCompanyReady(true);
          return;
        }

        const saved = localStorage.getItem("selectedCompany");

        if (saved) {
          setSelectedCompanyState(JSON.parse(saved));
        }
      } catch (error) {
        console.error("Error loading selected company:", error);
        setSelectedCompanyState(null);
      } finally {
        setCompanyReady(true);
      }
    };

    loadSelectedCompany();
  }, []);

  useEffect(() => {


    const fetchCompanies = async () => {

      console.count("CompanyContext fetchCompanies");

      try {
        const token = getToken();
        if (!token) {
          setCompanies([]);
          setSelectedCompanyState(null);
          return;
        }

        console.log("TOKEN:", token);
        console.log(
          "TOKEN EXISTS:",
          !!token
        );

        console.log(
          "API URL:",
          process.env.EXPO_PUBLIC_API_URL
        );

        const API_BASE =
          process.env.EXPO_PUBLIC_API_URL ||
          "https://api.maltechenterprises.com/api";

        const response = await fetch(
          `${API_BASE}/companies/user`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "FETCH COMPANIES ERROR"
          );

          console.error(
            "STATUS:",
            response.status
          );

          console.error(
            "STATUS TEXT:",
            response.statusText
          );

          console.error(
            "BODY:",
            errorText
          );
          setCompanies([]);
          return;
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          setCompanies([]);
          return;
        }

        setCompanies(data);

        // ✅ Validate selectedCompany
        if (data.length === 0) {
          setSelectedCompanyState(null);
          return;
        }

        if (!selectedCompany?.id) {
          saveSelectedCompany(data[0]);
          return;
        }

        const exists = data.find(c => c.id === selectedCompany.id);

        if (!exists) {
          saveSelectedCompany(data[0]);
        }

      } catch (error) {
        console.error("Error fetching companies:", error);
        setCompanies([]);
      }
    };

    if (companyReady) {
      fetchCompanies();
    }
  }, [companyReady]);

  const saveSelectedCompany = (company) => {
    setSelectedCompanyState(company);

    try {
      if (typeof localStorage === "undefined") return;

      if (company) {
        localStorage.setItem("selectedCompany", JSON.stringify(company));
      } else {
        localStorage.removeItem("selectedCompany");
      }
    } catch (error) {
      console.error("Error saving selected company:", error);
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany,
        setSelectedCompany: saveSelectedCompany,
        companies,
        setCompanies,
        companyReady,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => useContext(CompanyContext);