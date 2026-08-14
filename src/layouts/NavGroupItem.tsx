import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MdChevronRight } from 'react-icons/md';
import type { NavGroup } from './nav-config';

interface NavGroupItemProps {
  group: NavGroup;
}

export function NavGroupItem({ group }: NavGroupItemProps) {
  const location = useLocation();
  const Icon = group.icon;

  const hasActiveChild = group.children.some((child) => {
    if (child.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(child.path);
  });

  const [isOpen, setIsOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setIsOpen(true);
  }, [hasActiveChild]);

  return (
    <div>
      {/* ── Group header ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={[
          'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium transition-colors',
          hasActiveChild
            // Active parent: same highlight as active leaf items so the
            // whole group reads as "currently here"
            ? 'bg-pine-800 text-paper-50 hover:bg-pine-700'
            : 'text-paper-100 hover:bg-white/10',
        ].join(' ')}
      >
        <Icon className="h-5 w-5 shrink-0 opacity-80" />
        <span className="flex-1 truncate text-left text-sm font-semibold tracking-wide uppercase opacity-90">
          {group.label}
        </span>
        <MdChevronRight
          className={`h-4 w-4 shrink-0 opacity-60 transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
      </button>

      {/* ── Children ── */}
      {isOpen && (
        <div className="mt-0.5 mb-1 flex flex-col gap-0.5 pl-3 border-l border-white/10 ml-5">
          {group.children.map((child) => (
            <NavLink
              key={`${child.path}-${child.label}`}
              to={child.path}
              end={child.path === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.875rem] font-medium transition-colors',
                  isActive
                    ? 'bg-pine-700 text-paper-50 font-semibold'
                    : 'text-paper-100/75 hover:bg-white/10 hover:text-paper-50',
                ].join(' ')
              }
            >
              {() => {
                const ChildIcon = child.icon;
                return (
                  <>
                    <ChildIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{child.label}</span>
                  </>
                );
              }}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
