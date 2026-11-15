// Theme registry. A new look = a new file in this folder + an entry here.
// Theme API: { id, name, description, create(stage) -> { update(frame), idle(text) } }
// Theme ids are stored on devices (localStorage) – do not rename them.
import odcinek from './odcinek.js';
import zegary from './zegary.js';
import kokpit from './kokpit.js';
import neon from './neon.js';
import papier from './papier.js';
import lcd from './lcd.js';
import halo from './halo.js';
import orbit from './orbit.js';
import cluster from './cluster.js';
import hex from './hex.js';
import teal from './teal.js';
import trio from './trio.js';
import ladder from './ladder.js';
import eighties from './eighties.js';
import moto from './moto.js';
import track from './track.js';
import wedge from './wedge.js';
import scarlet from './scarlet.js';
import ember from './ember.js';

export const themes = [odcinek, zegary, kokpit, neon, papier, lcd, halo, orbit, cluster, hex, teal, trio, ladder, eighties, moto, track, wedge, scarlet, ember];
export const defaultTheme = odcinek;
export const findTheme = (id) => themes.find((t) => t.id === id);
