import React from 'react';
import DesktopSidebar from '../components/nav/DesktopSidebar';
import '../styles/layout.css';

type Props = { children?: React.ReactNode; title?: string };

export default function DesktopLayout({ children, title = 'Usena Flow' }: Props) {
  return (
    <div className="app app--desktop">
      <DesktopSidebar />
      <div className="app__content">
        <header className="app__header app__header--desktop">
          <h1 className="brand">{title}</h1>
        </header>
        <main className="app__main app__main--desktop">{children}</main>
      </div>
    </div>
  );
}