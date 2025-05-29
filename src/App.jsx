import React, { useState, useEffect } from "react";
import axios from "axios";
import Dashboard from "./Dashboard";

import {
  Container,
  Box,
  Typography,
  CircularProgress,
  CssBaseline,
  Paper,
} from "@mui/material";

const API_BASE = "http://localhost:8000";

function App() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasData, setHasData] = useState(false);

  // Fetch data
  const fetchData = async () => {
    try {
      const [transRes, catRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE}/transactions/`),
        axios.get(`${API_BASE}/categories/`),
        axios.get(`${API_BASE}/transactions/summary/`),
      ]);

      setTransactions(transRes.data);
      setCategories(catRes.data);
      setSummary(summaryRes.data);
      setHasData(transRes.data.length > 0);
    } catch (error) {
      console.error("Error fetching data:", error);
      setHasData(false);
    }
  };

  // Upload CSV
  const uploadCSV = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API_BASE}/upload-csv/`, formData);
      await fetchData();
      alert("CSV uploaded successfully!");
    } catch (error) {
      alert("Error uploading CSV: " + error.response?.data?.detail);
    } finally {
      setLoading(false);
    }
  };

  // Delete all data
// Delete all transactions
const deleteAllData = async () => {
  if (window.confirm("Are you sure you want to delete all transactions?")) {
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/transactions/`);
      await fetchData();
      alert("All transactions deleted successfully!");
    } catch (error) {
      alert("Error deleting all transactions: " + error.response?.data?.detail);
    } finally {
      setLoading(false);
    }
  }
};

  // Delete single transaction
  const deleteTransaction = async (transactionId) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        await axios.delete(`${API_BASE}/transactions/${transactionId}/`);
        await fetchData();
      } catch (error) {
        alert("Error deleting transaction: " + error.response?.data?.detail);
      }
    }
  };

  // Create category
  const createCategory = async (name) => {
    try {
      await axios.post(
        `${API_BASE}/categories/?name=${encodeURIComponent(name)}`
      );
      await fetchData();
    } catch (error) {
      alert("Error creating category: " + error.response?.data?.detail);
    }
  };

  // Update transaction category
  const updateTransactionCategory = async (transactionId, categoryName) => {
    try {
      await axios.put(
        `${API_BASE}/transactions/${transactionId}/category/?category_name=${encodeURIComponent(
          categoryName
        )}`
      );
      await fetchData();
    } catch (error) {
      alert("Error updating transaction: " + error.response?.data?.detail);
    }
  };

  // Get AI insights
  const getInsights = async () => {
    try {
      const response = await axios.get(`${API_BASE}/insights/`);
      setInsights(response.data);
    } catch (error) {
      console.error("Error getting insights:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <>

      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          background:
            "linear-gradient(135deg, #1e293b 0%, #7c3aed 50%, #3b82f6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Container maxWidth="md">
          <Paper
            elevation={8}
            sx={{
              p: 4,
              borderRadius: 3,
              bgcolor: "background.paper",
              boxShadow:
                "0 8px 16px rgba(124, 58, 237, 0.2), 0 4px 6px rgba(59, 130, 246, 0.15)",
            }}
          >
            <Box textAlign="center" mb={4}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: "bold",
                  background:
                    "linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 1,
                }}
              >
                💰 Finance Dashboard
              </Typography>
              <Typography
                variant="subtitle1"
                color="text.secondary"
                sx={{ maxWidth: 600, mx: "auto" }}
              >
                Upload your bank statement to get intelligent insights into your
                spending patterns
              </Typography>
            </Box>

            {loading ? (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight={200}
              >
                <CircularProgress />
              </Box>
            ) : (
              <Dashboard
                transactions={transactions}
                categories={categories}
                summary={summary}
                insights={insights}
                loading={loading}
                hasData={hasData}
                onUploadCSV={uploadCSV}
                onCreateCategory={createCategory}
                onUpdateTransaction={updateTransactionCategory}
                onGetInsights={getInsights}
                onDeleteAllData={deleteAllData}
                onDeleteTransaction={deleteTransaction}
              />
            )}
          </Paper>
        </Container>
      </Box>
    </>
  );
}

export default App;