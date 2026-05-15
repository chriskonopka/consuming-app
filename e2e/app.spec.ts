import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SAMPLE_PDF = readFileSync(resolve(__dirname, 'fixtures', 'sample.pdf'));

test.describe('Slice 1 — sign-in, themed shell, persistence, sign-out', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
  });

  test('renders the branded sign-in screen for unauthenticated users', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Bayer' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('signs in (via the e2e stub) and lands on the themed app shell', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('button', { name: /E2E User/ })).toBeVisible();
  });

  test('theme toggle persists across reloads', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();
    const initialTheme = await page
      .locator('html')
      .getAttribute('data-theme');

    const toggle = page.getByRole('button', { name: /Switch to (light|dark) theme/ });
    await toggle.click();
    const toggledTheme = initialTheme === 'dark' ? 'light' : 'dark';
    await expect(page.locator('html')).toHaveAttribute('data-theme', toggledTheme);

    await page.reload();
    // Inline theme script applies the persisted preference before first paint.
    await expect(page.locator('html')).toHaveAttribute('data-theme', toggledTheme);
  });

  test('sign-out returns the user to the sign-in screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: /E2E User/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('renders the standalone /health page without going through auth', async ({ page }) => {
    await page.goto('/health');
    await expect(
      page.getByRole('heading', { name: /scaffold health/i }),
    ).toBeVisible();
  });
});

test.describe('Slice 2 — indexer host integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
    // Sign in once via the stub so subsequent tests start authenticated.
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByTestId('indexer-stub')).toBeVisible();
  });

  test('mounts the indexer at the root path with no active collection', async ({ page }) => {
    await expect(page.getByTestId('indexer-stub')).toContainText('Active collection: none');
  });

  test('clicking a collection in the indexer pushes the URL to /c/{id}', async ({ page }) => {
    await page.getByRole('button', { name: 'Stub collection 1' }).click();
    await expect(page).toHaveURL(/\/c\/stub-collection-1$/);
    await expect(page.getByTestId('indexer-stub')).toContainText('Active collection: stub-collection-1');
  });

  test('back-button restores the previous collection', async ({ page }) => {
    await page.getByRole('button', { name: 'Stub collection 1' }).click();
    await expect(page).toHaveURL(/\/c\/stub-collection-1$/);

    await page.getByRole('button', { name: 'Stub collection 2' }).click();
    await expect(page).toHaveURL(/\/c\/stub-collection-2$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/c\/stub-collection-1$/);
    await expect(page.getByTestId('indexer-stub')).toContainText('Active collection: stub-collection-1');
  });

  test('deep-link to /c/{id} mounts the indexer with that collection active', async ({ page }) => {
    await page.goto('/c/stub-collection-2');
    await expect(page.getByTestId('indexer-stub')).toContainText('Active collection: stub-collection-2');
  });

  test('auth/expired event from the indexer flips the app to the sign-in screen', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Trigger auth/expired' }).click();
    // AuthGate flips back to the sign-in screen on `expired` status.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('Slice 3 — chat panel + SSE streaming', () => {
  // Mock the GlobalIndexer API at the Playwright network layer. Tests that
  // exercise chat go through every layer of the consuming app — but the API
  // base URL points at http://localhost:9999 (a fake), so we intercept here.
  test.beforeEach(async ({ page }) => {
    let messageSent = false;
    await page.route('**/conversations/list', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 1 }),
      }),
    );
    await page.route(
      /\/document-sets\/[^/]+\/conversations$/,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            conversationId: 'e2e-conv-1',
            documentSetId: 'stub-collection-1',
            userId: 'e2e-user',
            title: '',
            messageCount: 0,
            lastMessageAt: null,
            createdAt: '',
            updatedAt: '',
          }),
        }),
    );
    await page.route(
      /\/conversations\/[^/]+\/messages$/,
      (route) => {
        messageSent = true;
        const body = [
          'event: token',
          'data: {"text":"Hello "}',
          '',
          'event: token',
          'data: {"text":"world"}',
          '',
          'event: citation',
          'data: {"marker":1,"page":1,"x":10,"y":10,"w":50,"h":10,"fileName":"src.pdf"}',
          '',
          '',
        ].join('\n');
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body,
        });
      },
    );
    await page.route(
      /\/conversations\/[^/]+\/history$/,
      (route) => {
        const messages = messageSent
          ? [
              {
                id: 'srv-user-1',
                role: 'user',
                content: 'What is the governing law?',
                timestamp: '2026-05-06T00:00:00Z',
                llmProvider: null,
                citations: [],
              },
              {
                id: 'srv-assistant-1',
                role: 'assistant',
                content: 'Hello world [cite:1]',
                timestamp: '2026-05-06T00:00:01Z',
                llmProvider: 'Claude',
                citations: [
                  { marker: 1, page: 1, x: 10, y: 10, w: 50, h: 10, fileName: 'src.pdf' },
                ],
              },
            ]
          : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            conversationId: 'e2e-conv-1',
            totalMessages: messages.length,
            messages,
            etag: 'e',
          }),
        });
      },
    );
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByTestId('indexer-stub').waitFor();
  });

  test('chat toggle opens the chat panel showing the empty state', async ({ page }) => {
    await page.getByRole('button', { name: 'Stub collection 1' }).click();
    await page.getByRole('button', { name: 'Open chat panel' }).click();

    const dialog = page.getByRole('dialog', { name: 'Chat' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Ask anything about this collection')).toBeVisible();
  });

  test('sending a message reaches the server with the locked send-body shape', async ({
    page,
  }) => {
    // Track the actual /messages POST so we can assert the v1 contract:
    // body MUST be { content, llmProvider: 'Claude' } (REQUIREMENTS.md §4.9).
    // The SSE response itself is exercised via unit tests; here we verify the
    // full integration up to and including the send.
    let capturedBody: { content?: string; llmProvider?: string } | null = null;
    await page.route(/\/conversations\/[^/]+\/messages$/, async (route, request) => {
      capturedBody = JSON.parse(request.postData() ?? '{}');
      const body = [
        'event: token',
        'data: {"text":"Hello world"}',
        '',
        '',
      ].join('\n');
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body,
      });
    });

    await page.getByRole('button', { name: 'Stub collection 1' }).click();
    await page.getByRole('button', { name: 'Open chat panel' }).click();
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeEnabled();

    const composer = page.getByRole('textbox', { name: 'Message' });
    await composer.fill('What is the governing law?');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect.poll(() => capturedBody).toEqual({
      content: 'What is the governing law?',
      llmProvider: 'Claude',
    });
  });

  test('chat input is disabled when no collection is active', async ({ page }) => {
    await page.getByRole('button', { name: 'Open chat panel' }).click();
    await expect(page.getByText('Open a collection to start chatting.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeDisabled();
  });
});

test.describe('Slice 4 — citations + PDF viewer', () => {
  test.beforeEach(async ({ page }) => {
    // Same conversation/history mocks as slice 3 + document metadata + content.
    await page.route('**/conversations/list', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 1 }),
      }),
    );
    await page.route(
      /\/document-sets\/[^/]+\/conversations$/,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            conversationId: 'e2e-conv-1',
            documentSetId: 'stub-collection-1',
            userId: 'e2e-user',
            title: '',
            messageCount: 0,
            lastMessageAt: null,
            createdAt: '',
            updatedAt: '',
          }),
        }),
    );
    await page.route(/\/conversations\/[^/]+\/messages$/, (route) => {
      const body = [
        'event: token',
        'data: {"text":"New York "}',
        '',
        'event: token',
        'data: {"text":"applies [cite:1]"}',
        '',
        'event: citation',
        'data: {"marker":1,"page":1,"x":40,"y":40,"w":80,"h":12,"fileName":"contract.pdf"}',
        '',
        '',
      ].join('\n');
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store',
        },
        body,
      });
    });
    await page.route(/\/conversations\/[^/]+\/history$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId: 'e2e-conv-1',
          totalMessages: 2,
          messages: [
            {
              id: 'srv-user-1',
              role: 'user',
              content: 'Q',
              timestamp: '2026-05-06T00:00:00Z',
              llmProvider: null,
              citations: [],
            },
            {
              id: 'srv-assistant-1',
              role: 'assistant',
              content: 'New York applies [cite:1]',
              timestamp: '2026-05-06T00:00:01Z',
              llmProvider: 'Claude',
              citations: [
                { marker: 1, page: 1, x: 40, y: 40, w: 80, h: 12, fileName: 'contract.pdf' },
              ],
            },
          ],
          etag: 'e',
        }),
      }),
    );
    await page.route(/\/documents\/[^/]+$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documentId: 'contract.pdf',
          documentSetId: 'stub-collection-1',
          batchId: 'batch-1',
          folderId: null,
          fileName: 'contract.pdf',
          fileType: 'Contract',
          contentType: 'application/pdf',
          fileSizeBytes: SAMPLE_PDF.byteLength,
          status: 'Ready',
          chunkCount: 1,
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        }),
      }),
    );
    await page.route(/\/documents\/[^/]+\/content$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: SAMPLE_PDF,
      }),
    );

    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByTestId('indexer-stub').waitFor();
    await page.getByRole('button', { name: 'Stub collection 1' }).click();
  });

  test('opens the viewer at page 1 when the indexer emits document/selected', async ({ page }) => {
    await page.getByRole('button', { name: 'Open stub document' }).click();
    const dialog = page.getByRole('dialog', { name: 'Document viewer' });
    await expect(dialog).toBeVisible();
    // The stub indexer emits documentId 'stub-doc-1'; metadata route returns
    // 'contract.pdf' for any path so the heading still resolves.
    await expect(dialog.getByRole('heading', { name: 'contract.pdf' })).toBeVisible();
  });

  test('viewer header surfaces document metadata + page count', async ({ page }) => {
    await page.getByRole('button', { name: 'Open stub document' }).click();
    const dialog = page.getByRole('dialog', { name: 'Document viewer' });
    await expect(dialog.getByLabel('File type: Contract')).toBeVisible();
    // The minimal sample.pdf fixture is a single-page document.
    await expect(dialog.getByText('1 page', { exact: false })).toBeVisible();
  });

  test('Escape closes the document viewer', async ({ page }) => {
    await page.getByRole('button', { name: 'Open stub document' }).click();
    const dialog = page.getByRole('dialog', { name: 'Document viewer' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('resize separator is hittable (non-zero height) so the panel can be widened', async ({
    page,
  }) => {
    // Regression: the .resizeEdge wrapper was missing `display: flex`, so the
    // Splitter inside (which relies on `align-self: stretch`) collapsed to
    // height 0. The wrapper still showed the resize cursor, but pointerdown
    // never reached the Splitter and the panel was un-draggable.
    await page.getByRole('button', { name: 'Open stub document' }).click();
    await expect(page.getByRole('dialog', { name: 'Document viewer' })).toBeVisible();
    const separator = page.getByRole('separator', { name: 'Resize document viewer' });
    const box = await separator.boundingBox();
    expect(box, 'separator must be rendered').not.toBeNull();
    expect(box!.height).toBeGreaterThan(50);
    expect(box!.width).toBeGreaterThan(0);
  });
});

test.describe('Accessibility', () => {
  test('sign-in screen has no axe violations', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('signed-in shell has no axe violations in light theme', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('signed-in shell has no axe violations in dark theme', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
