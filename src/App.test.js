import { render, screen, waitFor } from '@testing-library/react';
import { getRedirectResult } from 'firebase/auth';
import App from './App';

const mockUseNetworkStatus = jest.fn();

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => children,
}));

jest.mock('firebase/auth', () => ({
  applyActionCode: jest.fn(() => Promise.resolve()),
  getAuth: jest.fn(() => ({ currentUser: null })),
  getRedirectResult: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
}));

jest.mock('./firebase', () => ({ db: {} }));
jest.mock('./store', () => () => ({ theme: 'barber' }));
jest.mock('./hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));
jest.mock('./components/LanguageContext', () => ({
  LanguageProvider: ({ children }) => children,
}));
jest.mock('./components/ProtectedRoute', () => ({ children }) => children);

jest.mock('./components/Navbar', () => () =>
  require('react').createElement('nav', { 'aria-label': 'Primary' }, 'Primary navigation')
);
jest.mock('./components/Home', () => () =>
  require('react').createElement('h1', null, 'Home screen')
);
jest.mock('./components/BarberShops', () => () =>
  require('react').createElement('h1', null, 'Shops screen')
);
jest.mock('./components/Auth', () => () => 'Auth screen');
jest.mock('./components/CreateBarberShop', () => () => 'Create shop screen');
jest.mock('./components/Account', () => () => 'Account screen');
jest.mock('./components/ShopLandingPage', () => () => 'Shop landing screen');
jest.mock('./components/BookNow', () => () => 'Booking screen');
jest.mock('./components/SubscriptionForm', () => () => 'Subscription screen');
jest.mock('./components/ClientManagementDashboard', () => () => 'Clients screen');
jest.mock('./components/MyAppointments', () => () => 'Appointments screen');
jest.mock('./components/ShopMessageView', () => () => 'Messages screen');
jest.mock('./components/OfflineIndicator', () => () =>
  require('react').createElement('div', { role: 'status' }, 'Offline status')
);
jest.mock('./components/EmployeeRegisterPage', () => () => 'Employee registration screen');
jest.mock('./components/PageBuilderWrapper', () => () => 'Shop editor screen');

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNetworkStatus.mockReturnValue(true);
  window.history.pushState({}, '', '/');
});

test('renders the application shell and default route without external services', async () => {
  render(<App />);

  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Home screen' })).toBeInTheDocument();
  expect(screen.queryByText('Offline status')).not.toBeInTheDocument();

  await waitFor(() => expect(getRedirectResult).toHaveBeenCalledTimes(1));
});

test('keeps direct route rendering and offline status in the app shell', async () => {
  mockUseNetworkStatus.mockReturnValue(false);
  window.history.pushState({}, '', '/shops');

  render(<App />);

  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Shops screen' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Home screen' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Offline status');

  await waitFor(() => expect(getRedirectResult).toHaveBeenCalledTimes(1));
});
