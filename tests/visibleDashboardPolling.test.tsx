// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
const network = vi.hoisted(() => vi.fn());
vi.mock('../src/features/shared/services/api', () => ({ApiClient: {authenticatedFetch: network}}));
vi.mock('../src/features/shared/context/AppContext', () => ({useAppContext: () => ({currentStaff: {role: 'Owner'}})}));
import NotificationCenter from '../src/features/shared/components/NotificationCenter';
import EventDrivenDashboard from '../src/features/shared/components/EventDrivenDashboard';
import BackgroundJobsDashboard from '../src/features/shared/components/BackgroundJobsDashboard';
import SessionManagementDashboard from '../src/features/shared/components/SessionManagementDashboard';
import ApplicationMonitoringDashboard from '../src/features/shared/components/ApplicationMonitoringDashboard';
import {startVisiblePolling} from '../src/features/shared/utils/visiblePolling';

let host: HTMLDivElement, root: Root, hidden: boolean;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  network.mockResolvedValue({json: async () => ({success: false})});
  host = document.createElement('div'); root = createRoot(host);
});
afterEach(async () => {await act(async () => root.unmount()); vi.restoreAllMocks(); vi.useRealTimers();});
async function visibility(value: boolean) {
  await act(async () => {hidden = value; document.dispatchEvent(new Event('visibilitychange'));});
}
describe.each([
  ['notifications', () => <NotificationCenter/>, 8000],
  ['events', () => <EventDrivenDashboard/>, 6000],
  ['jobs', () => <BackgroundJobsDashboard/>, 10000],
  ['session list', () => <SessionManagementDashboard currentSessionId="current" onSessionTerminated={() => {}}/>, 12000],
  ['monitoring', () => <ApplicationMonitoringDashboard/>, 3000],
] as const)('%s visibility', (_name, render, interval) => {
  it('stops hidden requests, refreshes once on return, and retains visible polling', async () => {
    await act(async () => root.render(render()));
    const requestsPerRefresh = network.mock.calls.length;
    expect(requestsPerRefresh).toBeGreaterThan(0);
    await visibility(true);
    await act(async () => {await vi.advanceTimersByTimeAsync(60000);});
    expect(network).toHaveBeenCalledTimes(requestsPerRefresh);
    await visibility(false);
    expect(network).toHaveBeenCalledTimes(requestsPerRefresh * 2);
    await act(async () => {await vi.advanceTimersByTimeAsync(interval);});
    expect(network).toHaveBeenCalledTimes(requestsPerRefresh * 3);
    await act(async () => root.unmount()); root = createRoot(host);
    await visibility(true); await visibility(false);
    await act(async () => {await vi.advanceTimersByTimeAsync(60000);});
    expect(network).toHaveBeenCalledTimes(requestsPerRefresh * 3);
  });
  it('does not start API work when mounted in a hidden tab', async () => {
    hidden = true;
    await act(async () => root.render(render()));
    expect(network).not.toHaveBeenCalled();
    await visibility(false);
    expect(network.mock.calls.length).toBeGreaterThan(0);
  });
});

it('does not overlap slow requests and performs one fresh read after returning during an in-flight request', async () => {
  let resolve!: () => void;
  network.mockImplementationOnce(() => new Promise<void>(done => {resolve = done;})).mockResolvedValue(undefined);
  const stop = startVisiblePolling(network, 1000);
  expect(network).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3000);
  expect(network).toHaveBeenCalledTimes(1);
  await visibility(true); await visibility(false);
  expect(network).toHaveBeenCalledTimes(1);
  resolve(); await Promise.resolve(); await Promise.resolve();
  expect(network).toHaveBeenCalledTimes(2);
  expect(network.mock.calls.map(call => call[0])).toEqual([false, true]);
  stop();
});
it('does not queue more work after cleanup while a request is still pending', async () => {
  let resolve!: () => void;
  network.mockImplementation(() => new Promise<void>(done => {resolve = done;}));
  const stop = startVisiblePolling(network, 1000);
  await visibility(true); await visibility(false);
  stop(); resolve(); await Promise.resolve();
  await vi.advanceTimersByTimeAsync(10000);
  expect(network).toHaveBeenCalledTimes(1);
});
it('ignores duplicate visible events and keeps polling after a failed read', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  network.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValue(undefined);
  const stop = startVisiblePolling(network, 1000);
  await Promise.resolve(); await visibility(false); await visibility(false);
  expect(network).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(network).toHaveBeenCalledTimes(2);
  expect(warning).toHaveBeenCalledTimes(1);
  stop();
});
