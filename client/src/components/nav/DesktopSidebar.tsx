import React from 'react';
import { Link, useLocation } from 'wouter';

export default function DesktopSidebar() {
  const [location] = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">USENA FLOW</div>
      <nav className="sidebar__nav">
        <Link 
          className={`sidebar__link ${location === '/' ? 'sidebar__link--active' : ''}`} 
          href="/"
        >
          Dashboard
        </Link>
        <Link 
          className={`sidebar__link ${location === '/calendar' ? 'sidebar__link--active' : ''}`} 
          href="/calendar"
        >
          Calendar
        </Link>
        <Link 
          className={`sidebar__link ${location === '/tasks' ? 'sidebar__link--active' : ''}`} 
          href="/tasks"
        >
          Tasks
        </Link>
        <Link 
          className={`sidebar__link ${location === '/settings' ? 'sidebar__link--active' : ''}`} 
          href="/settings"
        >
          Settings
        </Link>
      </nav>
    </aside>
  );
}