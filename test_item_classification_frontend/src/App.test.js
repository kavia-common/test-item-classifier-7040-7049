import { render, screen } from '@testing-library/react';
import App from './App';

test('renders import page title', () => {
  render(<App />);
  const title = screen.getByText(/Import Test Plan/i);
  expect(title).toBeInTheDocument();
});
