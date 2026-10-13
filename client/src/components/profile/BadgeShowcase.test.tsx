import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { profileBadges } from '../../test/fixtures/profile';
import BadgeShowcase from './BadgeShowcase';

describe.each([true, false])('explicit badge showcase, own profile: %s', own => {
  it('hides the entire section when no badges are selected despite earned achievements', () => {
    const { container } = render(<BadgeShowcase badges={profileBadges} selectedIds={[]} own={own} onEdit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('heading', { name: 'Wyróżnione osiągnięcia' })).not.toBeInTheDocument();
  });

  it.each([[3], [3, 1], [3, 1, 5]])('displays only the selected badges in the saved order: %j', (...ids) => {
    render(<BadgeShowcase badges={profileBadges} selectedIds={ids} own={own} onEdit={vi.fn()} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent))
      .toEqual(ids.map(id => `Odznaka ${id}`));
  });
});

it('never replaces missing or unearned selections with recently earned badges', () => {
  const { container } = render(<BadgeShowcase badges={profileBadges} selectedIds={[8, 999]} own={false} onEdit={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

it('opens editing for an owner with an explicit selection', async () => {
  const edit = vi.fn();
  render(<BadgeShowcase badges={profileBadges} selectedIds={[1]} own onEdit={edit} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Wybierz odznaki' }));
  expect(edit).toHaveBeenCalledOnce();
});
