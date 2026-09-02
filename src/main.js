import { Store } from './store.js';
import { mountApp } from './ui.js';
import { makeSeedData } from './seed.js';

const store = Store.bootstrap(makeSeedData);
mountApp(store);
