import React from 'react';
import MobileTabBar from '../components/nav/MobileTabBar';
import '../styles/layout.css';

type Props = { children?: React.ReactNode; title?: string };

export default function MobileLayout({ children, title = 'Usena Flow' }: Props) {
  return (
    <div className="app app--mobile">
      <header className="app__header app__header--mobile">
        <h1 className="brand">{title}</h1>
      </header>
      <main className="app__main app__main--mobile">{children}</main>
      <MobileTabBar />
    </div>
  );
}