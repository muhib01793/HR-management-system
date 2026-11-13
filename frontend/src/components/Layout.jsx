import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="layout">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="layout-main">
        <Header onMenu={() => setOpen((o) => !o)} />
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
