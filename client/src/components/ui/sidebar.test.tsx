import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider, useSidebar } from './sidebar';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

function Probe() {
  const { state, toggleSidebar } = useSidebar();
  return <button onClick={toggleSidebar}>{state}</button>;
}

afterEach(() => { document.cookie = 'sidebar_state=; path=/; max-age=0'; });

describe('sidebar preference', () => {
  it('restores a collapsed sidebar after remounting', () => {
    document.cookie = 'sidebar_state=; path=/; max-age=0';
    const view = render(<SidebarProvider><Probe /></SidebarProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'expanded' }));
    expect(document.cookie).toContain('sidebar_state=false');
    view.unmount();
    render(<SidebarProvider><Probe /></SidebarProvider>);
    expect(screen.getByRole('button', { name: 'collapsed' })).toBeInTheDocument();
  });

  it('uses the default for invalid cookies and gives controlled state precedence', () => {
    document.cookie = 'sidebar_state=invalid; path=/';
    const view = render(<SidebarProvider defaultOpen={false}><Probe /></SidebarProvider>);
    expect(screen.getByRole('button', { name: 'collapsed' })).toBeInTheDocument();
    document.cookie = 'sidebar_state=false; path=/';
    view.rerender(<SidebarProvider open><Probe /></SidebarProvider>);
    expect(screen.getByRole('button', { name: 'expanded' })).toBeInTheDocument();
  });
});
