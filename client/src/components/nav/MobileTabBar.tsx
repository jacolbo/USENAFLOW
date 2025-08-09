import React from 'react';

export default function MobileTabBar() {
  return (
    <nav className="tabbar">
      <button className="tabbar__btn">Dashboard</button>
      <button className="tabbar__btn">Calendar</button>
      <button className="tabbar__btn">Tasks</button>
      <button className="tabbar__btn">Settings</button>
    </nav>
  );
}