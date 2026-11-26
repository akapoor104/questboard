import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { DeviceGate, ParentGate, SessionProvider } from './app/session.tsx';
import { TodayProvider } from './app/TodayProvider.tsx';
import { ParentFrame } from './components/ParentFrame.tsx';
import { ToastProvider } from './components/Toast.tsx';
import { TopBar } from './components/TopBar.tsx';
import { NotFound } from './screens/NotFound.tsx';
import { Month } from './screens/kid/Month.tsx';
import { Today } from './screens/kid/Today.tsx';
import { Week } from './screens/kid/Week.tsx';
import { Home } from './screens/parent/Home.tsx';
import { Plan } from './screens/parent/Plan.tsx';
import { Settings } from './screens/parent/Settings.tsx';

export function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<DeviceGate><TodayProvider><TopBar /><Outlet /></TodayProvider></DeviceGate>}>
              <Route index element={<Today />} />
              <Route path="week" element={<Week />} />
              <Route path="week/:monday" element={<Week />} />
              <Route path="month" element={<Month />} />
              <Route path="month/:month" element={<Month />} />
            </Route>
            <Route path="parent" element={<ParentGate><ParentFrame><Outlet /></ParentFrame></ParentGate>}>
              <Route index element={<Home />} />
              <Route path="plan" element={<Plan />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
