import type { ComponentProps } from 'react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import './NavIconButton.css';

export default function NavIconButton({ className, ...props }: ComponentProps<'button'>) {
  return <Button type="button" variant="ghost" size="icon" {...props} className={cn('nav-icon-button', className)} />;
}
