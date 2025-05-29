import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import './index.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

function Dashboard({ 
  transactions, 
  categories, 
  summary, 
  insights,
  loading, 
  onUploadCSV, 
  onCreateCategory, 
  onUpdateTransaction,
  onGetInsights,
  onDeleteAllData,
  onDeleteTransaction
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [activeTab, setActiveTab] = useState('expenses');
  const [deleteError, setDeleteError] = useState(null);

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleUpload = () => {
    if (selectedFile) {
      onUploadCSV(selectedFile);
      setSelectedFile(null);
    }
  };

  const handleDeleteAllData = async () => {
    setDeleteError(null);
    try {
      await onDeleteAllData();
    } catch (err) {
      if (err.response && err.response.data) {
        setDeleteError('Error deleting data: ' + (err.response.data.detail || JSON.stringify(err.response.data)));
      } else if (err.message) {
        setDeleteError('Error deleting data: ' + err.message);
      } else {
        setDeleteError('Error deleting data: ' + JSON.stringify(err));
      }
    }
  };

  const handleCategoryChange = (transactionId, categoryName) => {
    onUpdateTransaction(transactionId, categoryName);
  };

  const handleCreateCategory = () => {
    if (newCategory.trim()) {
      onCreateCategory(newCategory.trim());
      setNewCategory('');
    }
  };

  const debits = transactions.filter(t => t.transaction_type === 'Debit');
  const credits = transactions.filter(t => t.transaction_type === 'Credit');
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Upload Bank Statement</h2>
        <div className="flex items-center space-x-4">
          <input type="file" accept=".csv" onChange={handleFileChange} className="file-input" />
          <button onClick={handleUpload} disabled={!selectedFile || loading} className="bg-green-900 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-green-800 hover:scale-105 transform transition duration-300">
            {loading ? 'Processing...' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Category Creation */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold">Create New Category</h2>
        <div className="category-input">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Enter category name"
            className="category-input"
          />
          <button onClick={handleCreateCategory} className="modern-button">
            Add Category
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="button-container">
        <button onClick={handleDeleteAllData} className="modern-button">
          🗑️ Clear All Data
        </button>
      </div>

      {deleteError && (
        <div className="modern-button">{deleteError}</div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {['expenses', 'payments', 'insights'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`modern-button ${
                  activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-blue-500'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Your Expenses</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th>Date</th><th>Details</th><th>Amount</th><th>Category</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {debits.map((t) => (
                        <tr key={t.id}>
                          <td>{new Date(t.date).toLocaleDateString()}</td>
                          <td>{t.details}</td>
                          <td>{t.amount.toFixed(2)} AED</td>
                          <td>
                            <select
                              value={t.category}
                              onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1"
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {summary.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Expense Summary</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <table className="w-full">
                        <thead>
                          <tr><th>Category</th><th className="text-right">Amount</th></tr>
                        </thead>
                        <tbody>
                          {summary.map((s, i) => (
                            <tr key={i} className="border-t border-gray-200">
                              <td>{s.category}</td>
                              <td className="text-right">{s.amount.toFixed(2)} AED</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Expenses by Category</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={summary} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="amount" label>
                          {summary.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value.toFixed(2)} AED`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Total Payments</h3>
              <p className="text-2xl font-bold">{totalCredits.toFixed(2)} AED</p>
            </div>
          )}

          {activeTab === 'insights' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">AI Insights</h3>
              <button
                onClick={onGetInsights}
                className="modern-button"
              >
                Generate Insights
              </button>
              <pre className="bg-black-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">{insights}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
