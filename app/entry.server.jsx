import {RemixServer} from '@remix-run/react';
import isbot from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';

/**
 * @param {Request} request
 * @param {number} responseStatusCode
 * @param {Headers} responseHeaders
 * @param {EntryContext} remixContext
 */
export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy();

  const body = await renderToReadableStream(
    <NonceProvider>
      <RemixServer context={remixContext} url={request.url} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        // eslint-disable-next-line no-console
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  console.log(header);
  let nonceVal = '';
  const oldHeader = header.split(';');

  const exceptions = [
    'https://cdn.judge.me',
    'https://cache.judge.me',
    'https://judgeme.imgix.net',
    'https://tracking.aws.judge.me',
    'https://judgeme-public-images.imgix.net',
    'https://vimeo.com',
    'https://i.vimeocdn.com',
    'https://judge.me',
    'https://ae01.alicdn.com',
    `'unsafe-inline'`,
    `'unsafe-eval'`,
    'data:',
  ];

  oldHeader.forEach((item, idx) => {
    if (
      item.includes('connect-src') ||
      item.includes('script-src') ||
      item.includes('style-src')
    ) {
      item +=
        ' https://cdn.judge.me https://cache.judge.me data: https://judgeme.imgix.net https://tracking.aws.judge.me https://judgeme-public-images.imgix.net https://vimeo.com https://judge.me';
      oldHeader[idx] = item;
    }

    if (item.includes('default-src')) {
      const defaultSrcList = item.split(' ');
      const nonceToken = defaultSrcList.find((subItem) =>
        subItem.includes('nonce'),
      );

      if (nonceToken) {
        nonceVal = nonceToken;
      }

      oldHeader[idx] =
        item +
        ` https://cdn.judge.me https://cache.judge.me 'unsafe-inline' 'unsafe-eval' data: https://judgeme.imgix.net https://tracking.aws.judge.me https://judgeme-public-images.imgix.net https://vimeo.com https://i.vimeocdn.com https://tracking.aws.judge.me`;
    }
  });

  let newHeader = oldHeader.join('; ');
  newHeader = newHeader.replace(nonceVal, '');

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', newHeader);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

/** @typedef {import('@shopify/remix-oxygen').EntryContext} EntryContext */
