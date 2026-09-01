/* eslint-disable testing-library/no-node-access */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GoogleBusinessStep from './GoogleBusinessStep';
import { addDoc, getDoc } from 'firebase/firestore';

const mockNavigate = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockRequestAccessToken = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../firebase', () => ({
  db: {},
  storage: {},
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn((database, path) => ({ database, path })),
  deleteDoc: jest.fn(() => Promise.resolve()),
  doc: jest.fn((database, ...path) => ({ database, path })),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
  updateDoc: jest.fn(() => Promise.resolve()),
}));

jest.mock('firebase/storage', () => ({
  getDownloadURL: jest.fn(),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'fixed-shop-url'),
}));

jest.mock('sweetalert2', () => ({
  fire: jest.fn(() => Promise.resolve()),
}));

jest.mock('./SuccessCelebration', () => () => null);

jest.mock('lucide-react', () => {
  const ReactModule = require('react');
  const Icon = (props) => ReactModule.createElement('svg', props);
  return {
    BarChart3: Icon,
    Building2: Icon,
    ChevronRight: Icon,
    Globe2: Icon,
    Medal: Icon,
    Search: Icon,
    Star: Icon,
    Users2: Icon,
  };
});

const shopData = {
  name: 'Focused Cuts',
  address: '1 Test Street',
  phoneNumber: '1234',
  email: 'owner@example.test',
  description: 'Test shop',
  services: [],
  images: [],
  availability: {},
  specialDates: {},
  categories: [],
  paymentMethods: [],
  pricingTier: 'standard',
};

const loadGoogleClient = async () => {
  const scripts = document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]');
  const script = scripts[scripts.length - 1];
  expect(script).not.toBeNull();
  fireEvent.load(script);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /yes, create my business profile/i })).toBeEnabled();
  });
};

const renderInParentForm = (overrides = {}) => {
  const props = {
    onNext: jest.fn(),
    onBack: jest.fn(),
    shopData,
    tempShopId: 'temp-shop-id',
    ...overrides,
  };
  const onSubmit = jest.fn((event) => event.preventDefault());

  render(
    <form onSubmit={onSubmit}>
      <GoogleBusinessStep {...props} />
    </form>
  );

  return { ...props, onSubmit };
};

describe('GoogleBusinessStep parent form behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: jest.fn(() => ({ requestAccessToken: mockRequestAccessToken })),
        },
      },
    };
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ uid: 'owner-uid' });
      return jest.fn();
    });
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ employees: [], manualEmployees: [], employeeRegistrationTokens: {} }),
    });
    addDoc.mockResolvedValue({ id: 'created-shop-id' });
  });

  afterEach(() => {
    document
      .querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')
      .forEach((script) => script.remove());
    delete window.google;
  });

  test('Google setup, Back, and Publish stay out of the parent submit path', async () => {
    const { onBack, onNext, onSubmit } = renderInParentForm();
    await loadGoogleClient();

    screen.getAllByRole('button').forEach((button) => {
      expect(button).toHaveAttribute('type', 'button');
    });

    fireEvent.click(screen.getByRole('button', { name: /yes, create my business profile/i }));
    expect(mockRequestAccessToken).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);

    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(publish).toBeEnabled();

    fireEvent.click(publish);
    fireEvent.click(publish);

    expect(mockRequestAccessToken).toHaveBeenCalledTimes(1);
    expect(publish).toBeDisabled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test.each([
    ['Skip for now', /skip for now/i],
    ['Skip', /^skip$/i],
  ])('%s uses the existing loading latch without submitting twice', async (label, buttonName) => {
    let releaseTempShop;
    getDoc.mockImplementationOnce(() => new Promise((resolve) => {
      releaseTempShop = resolve;
    }));
    const { onBack, onNext, onSubmit } = renderInParentForm();
    await loadGoogleClient();

    const skip = screen.getByRole('button', { name: buttonName });
    fireEvent.click(skip);
    fireEvent.click(skip);

    expect(skip).toBeDisabled();
    expect(skip).toHaveTextContent('Creating...');
    expect(onBack).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      releaseTempShop({
        exists: () => true,
        data: () => ({ employees: [], manualEmployees: [], employeeRegistrationTokens: {} }),
      });
    });

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledTimes(1);
    });
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({
      wantsToCreate: false,
      storeData: expect.objectContaining({ id: 'created-shop-id' }),
    }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
