import { render, screen } from '@testing-library/react';
import StatCard from '../components/StatCard';

test('renders title and value', () => {
  render(<StatCard title="Total Employees" value={14} icon="👥" />);
  expect(screen.getByText('Total Employees')).toBeInTheDocument();
  expect(screen.getByText('14')).toBeInTheDocument();
});

test('applies the given tone class', () => {
  const { container } = render(<StatCard title="Active" value={10} tone="green" />);
  expect(container.firstChild).toHaveClass('stat-green');
});
