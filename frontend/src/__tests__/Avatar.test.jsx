import { render, screen } from '@testing-library/react';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';

test('Avatar renders initials and never loads an image', () => {
  const { container } = render(<Avatar name="Hassan Javed" />);
  expect(screen.getByText('HJ')).toBeInTheDocument();
  expect(container.querySelector('img')).toBeNull();
});

test('EmptyState shows its title and message', () => {
  render(<EmptyState title="Nothing here" message="Add something" />);
  expect(screen.getByText('Nothing here')).toBeInTheDocument();
  expect(screen.getByText('Add something')).toBeInTheDocument();
});
