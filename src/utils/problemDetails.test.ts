import { problemDetails } from './problemDetails';

const problemResponse = (body: unknown, contentType = 'application/problem+json'): Response =>
  new Response(JSON.stringify(body), {
    status: 400,
    headers: { 'content-type': contentType },
  });

describe('problemDetails', () => {
  it('returns the parsed problem when content-type is application/problem+json', async () => {
    const result = await problemDetails(
      problemResponse({
        type: 'https://problems.api/validation-failed',
        title: 'Validation failed',
        status: 400,
        detail: 'content too long',
      }),
    );
    expect(result).toEqual({
      type: 'https://problems.api/validation-failed',
      title: 'Validation failed',
      status: 400,
      detail: 'content too long',
    });
  });

  it('preserves the optional errors field', async () => {
    const result = await problemDetails(
      problemResponse({
        type: 'https://problems.api/validation-failed',
        title: 'Validation failed',
        status: 400,
        detail: 'see errors',
        errors: { content: ['too long'] },
      }),
    );
    expect(result?.errors).toEqual({ content: ['too long'] });
  });

  it('returns null for non-problem content types', async () => {
    const result = await problemDetails(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(result).toBeNull();
  });

  it('returns null when body is malformed JSON despite the right content-type', async () => {
    const result = await problemDetails(
      new Response('{not json', {
        status: 400,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    expect(result).toBeNull();
  });

  it('returns null when fields are the wrong type', async () => {
    const result = await problemDetails(
      problemResponse({ type: 'x', title: 'y', status: 'not-a-number', detail: 'd' }),
    );
    expect(result).toBeNull();
  });

  it('handles the charset parameter on the content-type header', async () => {
    const result = await problemDetails(
      problemResponse(
        { type: 't', title: 'Title', status: 500, detail: 'detail' },
        'application/problem+json; charset=utf-8',
      ),
    );
    expect(result).not.toBeNull();
  });

  it('does not consume the response body (leaves it readable for callers)', async () => {
    const response = problemResponse({
      type: 't',
      title: 'Title',
      status: 500,
      detail: 'd',
    });
    await problemDetails(response);
    // Caller should still be able to read the body.
    const text = await response.text();
    expect(text).toContain('"title":"Title"');
  });
});
