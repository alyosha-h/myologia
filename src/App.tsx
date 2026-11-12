import { useEffect, useState } from 'react';
import { C } from './data';
import Home from './screens/Home';
import MaskTest from './screens/MaskTest';
import Week from './screens/Week';
import Workout from './screens/Workout';
import { useStore } from './store';
import type { Route } from './ui';

const parse = (): Route => {
  const h = location.hash.replace(/^#\/?/, '');
  return h === 'plate' || h === 'week' || h === 'masks' ? h : 'home';
};

// page ground + status-bar tint per screen
const GROUND: Record<Route, [string, string]> = {
  home: [C.ink, C.lime],
  plate: [C.lime, C.lime],
  week: [C.lav, C.lav],
  masks: [C.lime, C.lime],
};

export default function App() {
  const [route, setRoute] = useState<Route>(parse);
  const { ready } = useStore();

  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const [top, ground] = GROUND[route];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', top);
    document.documentElement.style.background = ground;
    document.documentElement.dataset.route = route;
  }, [route]);

  if (!ready) return null;
  const Screen = { home: Home, plate: Workout, week: Week, masks: MaskTest }[route];
  return <Screen key={route} />;
}
