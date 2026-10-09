import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

describe('shadcn components', () => {
  it('supports a labeled form and native form submission', async () => {
    let submitted: FormData | undefined;
    render(<Card>
      <CardHeader><CardTitle>Account</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={event => {
          event.preventDefault();
          submitted = new FormData(event.currentTarget);
        }}>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
          <Button type="submit">Save</Button>
        </form>
      </CardContent>
    </Card>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'tester@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(submitted?.get('email')).toBe('tester@example.com');
  });

  it('supports links through asChild and caller spacing overrides', () => {
    render(<Button asChild className="px-8"><a href="/learn">Learn</a></Button>);
    const link = screen.getByRole('link', { name: 'Learn' });
    expect(link).toHaveAttribute('href', '/learn');
    expect(link).toHaveClass('px-8');
    expect(link).not.toHaveClass('px-4');
  });
});
