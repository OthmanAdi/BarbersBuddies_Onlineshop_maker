import React from 'react';
import {render, screen} from '@testing-library/react';
import {
    appointmentMatchesDate as desktopAppointmentMatchesDate,
    civilDateForLocalDate as desktopCivilDateForLocalDate,
    generateTimeSlots,
    InvalidDateAppointments,
    partitionAgendaAppointments,
    TimeSlotView
} from './CustomAgenda';
import {
    appointmentMatchesDate as mobileAppointmentMatchesDate,
    civilDateForLocalDate as mobileCivilDateForLocalDate,
    generateMobileTimeSlots,
    MobileInvalidDateAppointments,
    MobileTimeSlotView,
    partitionMobileAgendaAppointments
} from './MobileAgenda';

jest.mock('framer-motion', () => {
    const ReactModule = require('react');
    const motionOnlyProps = new Set([
        'animate',
        'exit',
        'initial',
        'transition',
        'variants',
        'whileHover',
        'whileTap'
    ]);
    const motionComponent = (element) => ReactModule.forwardRef(({children, ...props}, ref) => {
        const domProps = Object.fromEntries(
            Object.entries(props).filter(([key]) => !motionOnlyProps.has(key))
        );
        return ReactModule.createElement(element, {...domProps, ref}, children);
    });

    return {
        AnimatePresence: ({children}) => children,
        motion: {
            button: motionComponent('button'),
            div: motionComponent('div')
        }
    };
});

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    getDocs: jest.fn(),
    orderBy: jest.fn(),
    query: jest.fn(),
    where: jest.fn()
}));

jest.mock('../firebase', () => ({db: {}}));

const selectedDate = new Date(2026, 8, 1, 12, 0, 0);
const makeAppointment = (id, selectedTime, selectedDateValue = '2026-09-01') => ({
    id,
    selectedDate: selectedDateValue,
    selectedTime,
    selectedServices: [],
    userName: `Customer ${id}`
});

const implementations = [
    {
        label: 'desktop',
        slots: generateTimeSlots,
        partition: partitionAgendaAppointments,
        matchesDate: desktopAppointmentMatchesDate,
        civilDateForDate: desktopCivilDateForLocalDate
    },
    {
        label: 'mobile',
        slots: generateMobileTimeSlots,
        partition: partitionMobileAgendaAppointments,
        matchesDate: mobileAppointmentMatchesDate,
        civilDateForDate: mobileCivilDateForLocalDate
    }
];

describe.each(implementations)('$label agenda civil classification', ({slots, partition, matchesDate, civilDateForDate}) => {
    test('uses exact canonical civil-date equality in the host timezone', () => {
        const hostCivilDate = civilDateForDate(selectedDate);

        expect(matchesDate(makeAppointment('same-day', '09:00', hostCivilDate), selectedDate)).toBe(true);
        expect(matchesDate(makeAppointment('adjacent-day', '09:00', '2026-08-31'), selectedDate)).toBe(false);
        expect(matchesDate(makeAppointment('noncanonical', '09:00', '2026-9-1'), selectedDate)).toBe(false);
    });

    test('never creates HH:60 and retains 09:53 and 23:59 as overflow', () => {
        const appointments = [
            makeAppointment('near-hour', '09:53'),
            makeAppointment('end-of-day', '23:59')
        ];

        const result = partition(appointments, selectedDate);

        expect(slots()).not.toContain('09:60');
        expect(result.overflow.map(({id}) => id)).toEqual(['near-hour', 'end-of-day']);
        expect(Object.values(result.bySlot).flat()).toHaveLength(0);
    });

    test('keeps off-grid and outside-hours records separate from exact slots', () => {
        const result = partition([
            makeAppointment('exact', '09:00'),
            makeAppointment('off-grid', '10:07'),
            makeAppointment('before-hours', '08:45'),
            makeAppointment('after-hours', '22:00')
        ], selectedDate);

        expect(result.bySlot['09:00'].map(({id}) => id)).toEqual(['exact']);
        expect(result.overflow.map(({id}) => id)).toEqual([
            'off-grid',
            'before-hours',
            'after-hours'
        ]);
    });

    test('quarantines malformed legacy dates and times without throwing', () => {
        const result = partition([
            makeAppointment('bad-time', '09:60'),
            makeAppointment('missing-time', undefined),
            makeAppointment('bad-date', '09:00', '09/01/2026'),
            makeAppointment('missing-date', '09:00', null)
        ], selectedDate);

        expect(result.invalidTime.map(({id}) => id)).toEqual(['bad-time', 'missing-time']);
        expect(result.invalidDate.map(({id}) => id)).toEqual(['bad-date', 'missing-date']);
    });
});

test.each([
    ['desktop', TimeSlotView],
    ['mobile', MobileTimeSlotView]
])('%s time view visibly reports overflow and malformed times', (_label, View) => {
    render(
        <View
            selectedDate={selectedDate}
            appointments={[
                makeAppointment('off-grid', '09:53'),
                makeAppointment('late', '23:59'),
                makeAppointment('malformed', '09:60')
            ]}
        />
    );

    expect(screen.getByRole('heading', {name: 'Unscheduled / agenda exceptions'})).toBeInTheDocument();
    expect(screen.getByText('Outside the visible 15-minute agenda grid: 09:53')).toBeInTheDocument();
    expect(screen.getByText('Outside the visible 15-minute agenda grid: 23:59')).toBeInTheDocument();
    expect(screen.getByText('Invalid legacy time: 09:60')).toBeInTheDocument();
});

test.each([
    ['desktop', InvalidDateAppointments],
    ['mobile', MobileInvalidDateAppointments]
])('%s agenda visibly quarantines malformed legacy dates', (_label, InvalidDates) => {
    render(
        <InvalidDates
            appointments={[
                makeAppointment('noncanonical-date', '09:00', '2026-9-1'),
                {...makeAppointment('missing-fields', '09:00'), selectedDate: null, userName: null}
            ]}
        />
    );

    expect(screen.getByRole('heading', {name: 'Unresolved legacy appointment dates'})).toBeInTheDocument();
    expect(screen.getByText('Invalid date: 2026-9-1')).toBeInTheDocument();
    expect(screen.getByText('Invalid date: missing date')).toBeInTheDocument();
    expect(screen.getByText('Unknown customer')).toBeInTheDocument();
});
