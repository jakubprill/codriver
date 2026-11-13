// Theme registry. A new look = a new file in this folder + an entry here.
// Theme API: { id, name, description, create(stage) -> { update(frame), idle(text) } }
// Theme ids are stored on devices (localStorage) – do not rename them.
import odcinek from './odcinek.js';
import zegary from './zegary.js';
import kokpit from './kokpit.js';
import neon from './neon.js';
import papier from './papier.js';
import lcd from './lcd.js';

export const themes = [odcinek, zegary, kokpit, neon, papier, lcd];
export const defaultTheme = odcinek;
export const findTheme = (id) => themes.find((t) => t.id === id);
