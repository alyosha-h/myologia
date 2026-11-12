import { useEffect, useState } from 'react';
import { C } from './data';
import Edit from './screens/Edit';
import Home from './screens/Home';
import MaskTest from './screens/MaskTest';
import Week from './screens/Week';
import Workout from './screens/Workout';
import { useStore } from './store';
import type { Route } from './ui';

const parse = (): Route => {
  const h = location.hash.replace(/^#\/?/, '');
  return h === 'plate' || h === 'week' || h === 'masks' || h === 'edit' ? h : 'home';
};

// colour at the top of each screen. ios standalone tints its status-bar blur band
// (and the overscroll area) from the root background, so the root has to match the top.
const TOP: Record<Route, string> = { home: C.ink, plate: C.lime, week: C.lav, masks: C.lime, edit: C.lime };

export default function App() {
  const [route, setRoute] = useState<Route>(parse);
  const { ready } = useStore();

  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const top = TOP[route];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', top);
    document.documentElement.style.background = top;
    document.documentElement.dataset.route = route;
  }, [route]);

  if (!ready) return null;
  const Screen = { home: Home, plate: Workout, week: Week, masks: MaskTest, edit: Edit }[route];
  return <Screen key={route} />;
}
