/// <reference types="vite/client" />

import type { TaroNoteApi } from '../shared/types';

declare global {
  interface Window {
    taroNote?: TaroNoteApi;
  }
}
