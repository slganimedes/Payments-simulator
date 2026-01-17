import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RootLayout from './layout/RootLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import BankDetails from './pages/BankDetails.jsx';
import Payments from './pages/Payments.jsx';
import FX from './pages/FX.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bank-details" element={<BankDetails />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/fx" element={<FX />} />
      </Route>
    </Routes>
  );
}
