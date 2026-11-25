import { NavLink } from 'react-router-dom';
import {
  Disc3,
  Home,
  Library,
  Maximize2,
  Minimize2,
  Search,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

const navItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search, end: false },
  { to: '/library', label: 'Your Library', icon: Library, end: false },
  { to: '/now-playing', label: 'Now Playing', icon: Disc3, end: false },
  { to: '/studio', label: 'Visualization Studio', icon: SlidersHorizontal, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

export function Sidebar() {
  const immersiveMode = useUIStore((s) => s.immersiveMode);
  const toggleImmersiveMode = useUIStore((s) => s.toggleImmersiveMode);

  return (
    <aside className="w-[60px] shrink-0 h-full flex flex-col items-center justify-between pt-4 pb-24 bg-white/[0.03] backdrop-blur-xl border-r border-white/[0.06] z-30 select-none">
      <nav className="flex flex-col items-center gap-2 w-full px-2" aria-label="Primary">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            aria-label={label}
            className={({ isActive }) =>
              `relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-white/12 text-white shadow-[0_0_16px_rgba(255,255,255,0.12)]'
                  : 'text-white/45 hover:text-white/90 hover:bg-white/[0.06]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute -left-2 w-0.5 h-5 rounded-r-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                )}
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col items-center gap-2 px-2">
        <button
          type="button"
          onClick={toggleImmersiveMode}
          title={immersiveMode ? 'Exit immersive mode' : 'Enter immersive mode'}
          aria-label={immersiveMode ? 'Exit immersive mode' : 'Enter immersive mode'}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 cursor-pointer ${
            immersiveMode
              ? 'bg-white/15 text-white shadow-[0_0_16px_rgba(255,255,255,0.16)]'
              : 'text-white/45 hover:text-white/90 hover:bg-white/[0.06]'
          }`}
        >
          {immersiveMode ? (
            <Minimize2 className="w-[18px] h-[18px]" strokeWidth={1.75} />
          ) : (
            <Maximize2 className="w-[18px] h-[18px]" strokeWidth={1.75} />
          )}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
