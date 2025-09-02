import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import RightSidebar from './RightSidebar';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 py-8">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <RightSidebar />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Layout;
