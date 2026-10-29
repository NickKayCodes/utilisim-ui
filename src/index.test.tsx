import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createRootMock, renderMock } = vi.hoisted(() => {
  const renderMock = vi.fn();
  return {
    renderMock,
    createRootMock: vi.fn(() => ({ render: renderMock })),
  };
});

vi.mock('react-dom/client', () => ({ createRoot: createRootMock }));

beforeEach(() => {
  vi.resetModules();
  createRootMock.mockClear();
  renderMock.mockClear();
  document.body.innerHTML = '';
});

describe('index bootstrap', () => {
  it('mounts the application into #root', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import('./index');

    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderMock).toHaveBeenCalledOnce();
  });

  it('throws when the root element is missing', async () => {
    await expect(import('./index')).rejects.toThrow('Root element #root was not found');
  });
});
