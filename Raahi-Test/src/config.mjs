import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(here, '..');
export const baseUrl = process.env.RAAHI_BASE_URL || 'https://raahi-mini.netlify.app';

export const personas = {
  'admin-ajit': { role: 'admin', expected: /\/admin-panel(?:\/|$)/ },
  'driver-dipti': { role: 'driver', expected: /\/driver-(?:route-selection|active-car-screen)(?:\/|$)/ },
  'driver-rajeev4': { role: 'driver', expected: /\/driver-(?:route-selection|active-car-screen)(?:\/|$)/ },
  'passenger-1': { role: 'passenger', expected: /^\/$/ },
  'passenger-2': { role: 'passenger', expected: /^\/$/ },
};

export function profileDir(persona) {
  return path.join(rootDir, 'profiles', persona);
}

export function reportDir() {
  return path.join(rootDir, 'reports');
}
