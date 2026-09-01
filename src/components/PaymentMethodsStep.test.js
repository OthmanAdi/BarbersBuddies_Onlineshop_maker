import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PaymentMethodsStep from './PaymentMethodsStep';

jest.mock('framer-motion', () => {
  const ReactModule = require('react');
  const motionOnlyProps = new Set([
    'animate',
    'exit',
    'initial',
    'layout',
    'transition',
    'whileHover',
    'whileTap',
  ]);
  const motionComponent = (element) => ReactModule.forwardRef(({ children, ...props }, ref) => {
    const domProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !motionOnlyProps.has(key))
    );
    return ReactModule.createElement(element, { ...domProps, ref }, children);
  });

  return {
    AnimatePresence: ({ children }) => children,
    motion: {
      button: motionComponent('button'),
      div: motionComponent('div'),
      h1: motionComponent('h1'),
      p: motionComponent('p'),
    },
  };
});

jest.mock('sweetalert2', () => ({
  fire: jest.fn(),
}));

const renderInParentForm = (overrides = {}) => {
  const props = {
    paymentMethods: [],
    onSelect: jest.fn(),
    setFormTouched: jest.fn(),
    handleStepChange: jest.fn(),
    t: {},
    ...overrides,
  };
  const onSubmit = jest.fn((event) => event.preventDefault());

  render(
    <form onSubmit={onSubmit}>
      <PaymentMethodsStep {...props} />
    </form>
  );

  return { ...props, onSubmit };
};

describe('PaymentMethodsStep form behavior', () => {
  test('selection and navigation controls never submit the parent form', () => {
    const { handleStepChange, onSelect, onSubmit, setFormTouched } = renderInParentForm();

    screen.getAllByRole('button').forEach((button) => {
      expect(button).toHaveAttribute('type', 'button');
    });

    const visa = screen.getByRole('button', { name: /visa/i });
    expect(visa).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(visa);

    expect(onSelect).toHaveBeenCalledWith(['visa']);
    expect(setFormTouched).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: /visa/i })).toHaveAttribute('aria-pressed', 'true');
    expect(onSubmit).not.toHaveBeenCalled();

    const other = screen.getByRole('button', { name: 'Other' });
    fireEvent.click(other);
    expect(other).toHaveAttribute('aria-pressed', 'true');

    const back = screen.getByRole('button', { name: 'Back' });
    fireEvent.click(back);
    expect(handleStepChange).toHaveBeenCalledWith(5);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(continueButton);
    expect(handleStepChange).toHaveBeenCalledWith(7);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('continue remains disabled until a payment method is selected', () => {
    const { handleStepChange, onSubmit } = renderInParentForm();
    const continueButton = screen.getByRole('button', { name: 'Continue' });

    expect(continueButton).toBeDisabled();
    fireEvent.click(continueButton);

    expect(handleStepChange).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /mastercard/i }));
    expect(continueButton).toBeEnabled();
  });
});
