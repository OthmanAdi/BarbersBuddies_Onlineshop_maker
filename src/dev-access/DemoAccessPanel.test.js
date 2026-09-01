import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {resolveAppRuntime} from '../runtime/appRuntime';
import DemoAccessPanel from './DemoAccessPanel';

const developmentRuntime = resolveAppRuntime({NODE_ENV: 'development'});
const disabledRuntime = resolveAppRuntime({
    NODE_ENV: 'development',
    REACT_APP_DEMO_ACCESS: 'false'
});

const renderPanel = (access, runtime = developmentRuntime) => render(
    <MemoryRouter initialEntries={['/auth']}>
        <DemoAccessPanel runtime={runtime} access={access} />
        <Routes>
            <Route path="/auth" element={null} />
            <Route path="/account" element={<h1>Professional account</h1>} />
        </Routes>
    </MemoryRouter>
);

describe('DemoAccessPanel', () => {
    test('does not render when the central runtime disables demo access', () => {
        const access = {enter: jest.fn()};

        renderPanel(access, disabledRuntime);

        expect(screen.queryByRole('complementary', {name: 'Local demo access'}))
            .not.toBeInTheDocument();
        expect(access.enter).not.toHaveBeenCalled();
    });

    test('enters the professional persona once and replaces the route', async () => {
        let resolveEntry;
        const access = {
            enter: jest.fn(() => new Promise((resolve) => {
                resolveEntry = resolve;
            }))
        };
        renderPanel(access);

        const button = screen.getByRole('button', {name: 'Enter professional demo'});
        await act(async () => {
            button.click();
        });

        await waitFor(() => expect(button).toBeDisabled());
        expect(screen.getByText('Preparing workspace…')).toBeInTheDocument();
        button.click();
        expect(access.enter).toHaveBeenCalledTimes(1);
        expect(access.enter).toHaveBeenCalledWith('professional');

        await act(async () => {
            resolveEntry({destination: '/account'});
        });
        expect(await screen.findByRole('heading', {name: 'Professional account'}))
            .toBeInTheDocument();
    });

    test('shows one sanitized recovery message and allows retry', async () => {
        const access = {
            enter: jest.fn()
                .mockRejectedValueOnce(new Error('raw Firebase secret'))
                .mockResolvedValueOnce({destination: '/account'})
        };
        renderPanel(access);

        const firstButton = screen.getByRole('button', {name: 'Enter professional demo'});
        await act(async () => {
            firstButton.click();
        });

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Confirm that Auth and Firestore emulators are running.');
        expect(alert).not.toHaveTextContent(/raw|secret|firebase secret/i);

        const retryButton = screen.getByRole('button', {name: 'Enter professional demo'});
        await act(async () => {
            retryButton.click();
        });
        await waitFor(() => expect(access.enter).toHaveBeenCalledTimes(2));
        expect(await screen.findByRole('heading', {name: 'Professional account'}))
            .toBeInTheDocument();
    });
});
