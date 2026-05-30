// Development environment. The API base URL is relative so the dev-server proxy
// (see proxy.conf.json) forwards calls to the Express mock backend on :3000.
export const environment = {
  production: false,
  apiBaseUrl: '/api',
  enableNgrxDevtools: true
};
