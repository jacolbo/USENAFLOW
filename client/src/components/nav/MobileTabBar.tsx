import React from 'react';
import { Link, useLocation } from 'wouter';

export default function MobileTabBar() {
  const [location] = useLocation();

  return (
    <nav className="tabbar">
      <Link href="/">
        <button className={`tabbar__btn ${location === '/' ? 'tabbar__btn--active' : ''}`}>
          Dashboard
        </button>
      </Link>
      <Link href="/calendar">
        <button className={`tabbar__btn ${location === '/calendar' ? 'tabbar__btn--active' : ''}`}>
          Calendar
        </button>
      </Link>
      <Link href="/tasks">
        <button className={`tabbar__btn ${location === '/tasks' ? 'tabbar__btn--active' : ''}`}>
          Tasks
        </button>
      </Link>
      <Link href="/settings">
        <button className={`tabbar__btn ${location === '/settings' ? 'tabbar__btn--active' : ''}`}>
          Settings
        </button>
      </Link>
    </nav>
  );
}