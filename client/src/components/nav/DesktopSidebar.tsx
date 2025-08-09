import React from 'react';

export default function DesktopSidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">Usena Flow</div>
      <nav className="sidebar__nav">
        <a className="sidebar__link" href="#dash">Dashboard</a>
        <a className="sidebar__link" href="#calendar">Calendar</a>
        <a className="sidebar__link" href="#tasks">Tasks</a>
        <a className="sidebar__link" href="#settings">Settings</a>
      </nav>
    </aside>
  );
}