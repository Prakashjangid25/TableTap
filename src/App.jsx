import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Onboarding from './components/Onboarding.jsx';
import SuperAdmin from './components/SuperAdmin.jsx';
import RestaurantAdmin from './components/RestaurantAdmin.jsx';
import KitchenPanel from './components/KitchenPanel.jsx';
import CustomerMenu from './components/CustomerMenu.jsx';
import { seedDatabaseIfEmpty } from './dbService';

export default function App() {
  useEffect(() => {
    // Attempt to seed Firestore with initial premium catalogs if they do not exist
    seedDatabaseIfEmpty();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/super-admin" element={<SuperAdmin />} />
      <Route path="/admin" element={<RestaurantAdmin />} />
      <Route path="/kitchen" element={<KitchenPanel />} />
      <Route path="/customer" element={<CustomerMenu />} />
      <Route path="*" element={<Onboarding />} />
    </Routes>
  );
}
