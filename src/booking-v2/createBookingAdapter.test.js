import {
  CreateBookingAdapterError,
  buildCreateBookingV2Payload,
} from './createBookingAdapter';

function formState(overrides = {}) {
  return {
    shop: {
      id: 'shop-123',
      email: 'owner@example.test',
      bookingPolicy: {
        consentVersion: 'booking-v2-2026-09',
        cancellationNoticeMinutes: 60,
        guestBookingEnabled: true,
      },
    },
    selectedServices: [{
      id: 'haircut',
      name: 'Haircut',
      price: '20.00',
      durationMinutes: 30,
    }],
    selectedDate: '2026-09-07',
    selectedTime: '09:30',
    userName: '  Customer Example  ',
    userEmail: '  CUSTOMER@EXAMPLE.TEST  ',
    userPhone: '  +49 123 456789  ',
    selectedEmployee: { id: 'employee-1', name: 'Employee One' },
    ...overrides,
  };
}

describe('BookNow state to booking v2 create payload', () => {
  test('maps only the strict server command fields', () => {
    const payload = buildCreateBookingV2Payload(formState());

    expect(payload).toEqual({
      shopId: 'shop-123',
      requestedEmployeeId: 'employee-1',
      serviceIds: ['haircut'],
      localDate: '2026-09-07',
      localStartTime: '09:30',
      customer: {
        name: 'Customer Example',
        email: 'customer@example.test',
        phone: '+49 123 456789',
      },
      consentVersion: 'booking-v2-2026-09',
    });
    expect(Object.keys(payload).sort()).toEqual([
      'consentVersion',
      'customer',
      'localDate',
      'localStartTime',
      'requestedEmployeeId',
      'serviceIds',
      'shopId',
    ]);
  });

  test('does not copy client-owned authority or display fields', () => {
    const state = formState({
      status: 'confirmed',
      totalPrice: '0.01',
      timeSlotId: 'attacker-slot',
      createdAt: '1969-01-01T00:00:00.000Z',
      customerUid: 'spoofed-customer',
      shopOwnerId: 'spoofed-owner',
    });
    state.shop.resourceId = 'spoofed-resource';
    state.selectedServices[0].priceMinor = 1;
    state.selectedEmployee.resourceId = 'spoofed-resource';

    const serialized = JSON.stringify(buildCreateBookingV2Payload(state));

    for (const forbidden of [
      'status',
      'totalPrice',
      'timeSlotId',
      'createdAt',
      'customerUid',
      'shopOwnerId',
      'resourceId',
      'priceMinor',
      'employeeName',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test.each([
    ['missing service id', [{ name: 'Legacy service' }], 'selectedServices[0].id'],
    ['blank service id', [{ id: '  ' }], 'selectedServices[0].id'],
    ['duplicate service id', [{ id: 'haircut' }, { id: 'haircut' }],
      'selectedServices[1].id'],
  ])('refuses %s', (_label, selectedServices, field) => {
    expect(() => buildCreateBookingV2Payload(formState({ selectedServices })))
      .toThrow(expect.objectContaining({ field }));
  });

  test.each([
    ['missing booking policy', undefined],
    ['missing consent version', { guestBookingEnabled: true }],
    ['blank consent version', { consentVersion: ' ' }],
  ])('refuses %s', (_label, bookingPolicy) => {
    const state = formState();
    state.shop.bookingPolicy = bookingPolicy;

    expect(() => buildCreateBookingV2Payload(state)).toThrow(
      expect.objectContaining({ name: 'CreateBookingAdapterError' })
    );
  });

  test('allows server-side employee allocation by emitting explicit null', () => {
    expect(buildCreateBookingV2Payload(formState({ selectedEmployee: null })))
      .toMatchObject({ requestedEmployeeId: null });
  });

  test.each([
    ['invalid civil date', { selectedDate: '2026-02-30' }, 'selectedDate'],
    ['invalid civil time', { selectedTime: '24:00' }, 'selectedTime'],
    ['missing customer name', { userName: '' }, 'customer.name'],
  ])('fails locally for %s', (_label, override, field) => {
    expect(() => buildCreateBookingV2Payload(formState(override))).toThrow(
      expect.objectContaining({ field })
    );
  });

  test('returns an immutable payload snapshot', () => {
    const payload = buildCreateBookingV2Payload(formState());

    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.customer)).toBe(true);
    expect(Object.isFrozen(payload.serviceIds)).toBe(true);
  });

  test('exposes a typed adapter error', () => {
    expect(() => buildCreateBookingV2Payload()).toThrow(CreateBookingAdapterError);
  });
});
