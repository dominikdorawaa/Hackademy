import { Link, NavLink, Outlet, matchPath, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Flag,
  LayoutDashboard,
  MessageSquareWarning,
  Moon,
  Route as RouteIcon,
  Sun,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTheme } from '../../context/ThemeContext';
import { useAdminAccess } from './adminAccess';

interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
  match: string[];
  adminOnly?: boolean;
  children?: { title: string; to: string; match: string[]; exclude?: string[] }[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    label: 'Przegląd',
    items: [{ title: 'Pulpit', to: '/admin', icon: LayoutDashboard, match: ['/admin'], adminOnly: true }],
  },
  {
    label: 'Treści',
    items: [
      {
        title: 'Ścieżki',
        to: '/admin/paths',
        icon: RouteIcon,
        match: ['/admin/paths/*'],
        children: [
          { title: 'Lista ścieżek', to: '/admin/paths', match: ['/admin/paths', '/admin/paths/:pathId'], exclude: ['/admin/paths/rooms'] },
          { title: 'Pokoje ścieżek', to: '/admin/paths/rooms', match: ['/admin/paths/rooms/*'] },
        ],
      },
      { title: 'Pokoje CTF', to: '/admin/ctf', icon: Flag, match: ['/admin/ctf/*'] },
    ],
  },
  {
    label: 'Społeczność',
    items: [
      { title: 'Użytkownicy', to: '/admin/users', icon: Users, match: ['/admin/users'], adminOnly: true },
      { title: 'Zgłoszenia', to: '/admin/reports', icon: MessageSquareWarning, match: ['/admin/reports'], adminOnly: true },
    ],
  },
];

function matches(pathname: string, patterns: string[], exclude: string[] = []) {
  if (exclude.some((pattern) => matchPath({ path: pattern, end: false }, pathname))) return false;
  return patterns.some((pattern) => matchPath({ path: pattern, end: true }, pathname));
}

function visibleNavigation(isAdmin: boolean) {
  return navigation
    .map((group) => ({ ...group, items: group.items.filter((item) => isAdmin || !item.adminOnly) }))
    .filter((group) => group.items.length > 0);
}

function currentSectionTitle(pathname: string, isAdmin: boolean) {
  for (const group of visibleNavigation(isAdmin)) {
    for (const item of group.items) {
      const child = item.children?.find((entry) => matches(pathname, entry.match, entry.exclude));
      if (child) return child.title;
      if (matches(pathname, item.match)) return item.title;
    }
  }
  return 'Panel';
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw';
  return (
    <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label={nextLabel} title={nextLabel}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

export default function AdminLayout() {
  const { pathname } = useLocation();
  const { isAdmin, username } = useAdminAccess();
  const groups = visibleNavigation(isAdmin);
  const roleLabel = isAdmin ? 'Panel administratora' : 'Panel eksperta';

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="admin-shell bg-background text-foreground">
        <Sidebar collapsible="icon" aria-label="Nawigacja panelu">
          <SidebarHeader className="h-14 justify-center border-b border-sidebar-border py-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  asChild
                  tooltip="Hackademy"
                  className="hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:justify-center"
                >
                  <Link to={isAdmin ? '/admin' : '/admin/paths'} aria-label={`Hackademy, ${roleLabel.toLowerCase()}`}>
                    <img
                      src="/hackademy-wordmark.png"
                      alt=""
                      width={417}
                      height={120}
                      className="h-10 w-auto invert group-data-[collapsible=icon]:hidden dark:invert-0"
                    />
                    <img
                      src="/hackademy-mark.png"
                      alt=""
                      width={72}
                      height={120}
                      className="hidden h-8 w-auto group-data-[collapsible=icon]:block"
                    />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            {groups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const active = matches(pathname, item.match);
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                            <NavLink to={item.to} end>
                              <item.icon aria-hidden="true" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                          {item.children && (
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.to}>
                                  <SidebarMenuSubButton asChild isActive={matches(pathname, child.match, child.exclude)}>
                                    <NavLink to={child.to} end>
                                      <span>{child.title}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Wróć do aplikacji">
                  <Link to="/dashboard">
                    <ArrowLeft aria-hidden="true" />
                    <span>Wróć do aplikacji</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <p className="truncate px-2 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              <span className="font-medium text-sidebar-foreground">{username}</span>
              <span aria-hidden="true"> · </span>
              {roleLabel}
            </p>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <SidebarTrigger aria-label="Przełącz nawigację" />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <p className="truncate text-sm font-medium" aria-live="polite">{currentSectionTitle(pathname, isAdmin)}</p>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
