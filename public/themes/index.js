// Rejestr motywów. Nowy wygląd = nowy plik w tym katalogu + wpis tutaj.
// API motywu: { id, name, description, create(stage) -> { update(frame), idle(text) } }
import odcinek from './odcinek.js';
import zegary from './zegary.js';
import kokpit from './kokpit.js';
import neon from './neon.js';
import papier from './papier.js';
import lcd from './lcd.js';

export const themes = [odcinek, zegary, kokpit, neon, papier, lcd];
export const defaultTheme = odcinek;
export const findTheme = (id) => themes.find((t) => t.id === id);
