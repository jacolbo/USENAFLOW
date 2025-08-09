import React from 'react';
import { getPlatform } from '../../utils/platform';
import MobileWeekStrip from './MobileWeekStrip';
import DesktopWeekBoard from './DesktopWeekBoard';

export default function Calendar(){
  const p = getPlatform();
  const mobile = p === 'ios-app' || p === 'ios-web' || p === 'web-mobile';
  return mobile ? <MobileWeekStrip /> : <DesktopWeekBoard />;
}