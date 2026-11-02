import { SoundEngine } from './audio.js';
import { Sculpture } from './sculpture.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const scenes = {
  ember: { name: 'Ember', number: '01', heading: ['A slower kind', 'of energy.'], description: ['Warm tones. A quiet spark.', 'A place to settle in.'], mix: { texture: 65, depth: 40, drift: 50 }, form: 'TOROID' },
  tidal: { name: 'Tidal', number: '02', heading: ['Let the day', 'wash away.'], description: ['Soft rain. An open horizon.', 'A little room to flow.'], mix: { texture: 80, depth: 65, drift: 30 }, form: 'UNDULATION' },
  orbit: { name: 'Orbit', number: '03', heading: ['A little further', 'from everything.'], description: ['Deep tones. A wider view.', 'Permission to drift.'], mix: { texture: 25, depth: 35, drift: 80 }, form: 'SUSPENSION' },
};
const SETTINGS_KEY = 'stillform:settings:v1';
const MIXES_KEY = 'stillform:mixes:v1';
const isScene = (value) => typeof value === 'string' && Object.hasOwn(scenes, value);
const clamp = (value, fallback = 50) => Number.isFinite(value) ? Math.round(Math.max(0, Math.min(100, value))) : fallback;
const validMix = (mix) => mix && ['texture', 'depth', 'drift'].every((key) => Number.isFinite(mix[key]) && mix[key] >= 0 && mix[key] <= 100);
function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
const settings = readStorage(SETTINGS_KEY, {});
const initialScene = isScene(settings?.scene) ? settings.scene : 'ember';
const state = {
  scene: initialScene,
  mix: validMix(settings?.mix) ? { ...settings.mix } : { ...scenes[initialScene].mix },
  master: clamp(settings?.master, 55),
  playing: false,
  busy: false,
};
const storedMixes = readStorage(MIXES_KEY, []);
let savedMixes = Array.isArray(storedMixes) ? storedMixes.filter((mix) => mix && typeof mix.id === 'string' && typeof mix.name === 'string' && mix.name.trim().length > 0 && mix.name.length <= 40 && isScene(mix.scene) && validMix(mix.mix) && Number.isFinite(mix.master)).slice(0, 12) : [];
const engine = new SoundEngine();
const sculpture = new Sculpture($('#sculpture'));
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = motionQuery.matches;
let toastTimeout;

function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 4200);
}
function announce(message) { $('#announcer').textContent = message; }
function storeSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ scene: state.scene, mix: state.mix, master: state.master })); } catch { /* Listening still works if browser storage is unavailable. */ }
}
function setLines(element, lines) {
  element.replaceChildren(document.createTextNode(lines[0]), document.createElement('br'), document.createTextNode(lines[1]));
}
function syncRanges() {
  ['texture', 'depth', 'drift', 'master'].forEach((key) => {
    const value = key === 'master' ? state.master : state.mix[key];
    $('#' + key).value = value;
    $('#' + key).style.setProperty('--fill', value + '%');
    $('#' + key + '-value').textContent = value + '%';
  });
}
function selectScene(scene, useDefaults = true, feedback = true) {
  if (!isScene(scene)) return;
  state.scene = scene;
  if (useDefaults) state.mix = { ...scenes[scene].mix };
  const info = scenes[scene];
  document.body.dataset.atmosphere = scene;
  $('.cover-stage').dataset.current = scene;
  $('#visual-room').dataset.scene = scene;
  $('#visual-label').textContent = 'THE ' + info.name.toUpperCase() + ' ROOM';
  $('#scene-name').textContent = info.name;
  $('#track-number').textContent = info.number + ' / 03';
  $('#form-label').textContent = 'FORM ' + info.number + ' / ' + info.form;
  setLines($('#room-title'), info.heading);
  setLines($('#scene-description'), info.description);
  $$('[data-scene-select]').forEach((button) => {
    const active = button.dataset.sceneSelect === scene;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $$('[data-cover-scene]').forEach((button) => {
    const active = button.dataset.coverScene === scene;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  sculpture.setScene(scene);
  engine.setScene(scene);
  engine.setMix(state.mix, state.master);
  syncRanges();
  storeSettings();
  if (feedback) announce(info.name + ' soundscape selected.');
}
function syncPlayback() {
  document.body.classList.toggle('is-playing', state.playing);
  $$('[data-play]').forEach((button) => {
    button.setAttribute('aria-label', state.playing ? 'Pause sound' : 'Start sound');
    button.setAttribute('aria-pressed', String(state.playing));
    button.disabled = state.busy;
  });
  $('[data-play-label]').textContent = state.playing ? 'Sound on' : 'Sound off';
  $('#play-icon').replaceChildren();
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', state.playing ? 'M7 5h3v14H7zM15 5h3v14h-3z' : 'm9 5 11 7-11 7Z');
  $('#play-icon').append(path);
  $('#playback-title').textContent = state.playing ? 'You’re right where you are.' : 'Press play. Be here.';
  $('#playback-subtitle').textContent = state.playing ? scenes[state.scene].name + ' · an endless soundscape' : 'Headphones feel even better';
  $('#hero-play-label').textContent = state.playing ? 'Pause your atmosphere' : 'Listen to ' + scenes[state.scene].name;
}
async function setPlaying(playing) {
  if (state.busy) return;
  state.busy = true;
  syncPlayback();
  try {
    if (playing) await engine.play(state.scene, state.mix, state.master);
    else await engine.pause();
    state.playing = playing;
    announce(playing ? 'Sound is playing.' : 'Sound paused.');
    if (engine.context) engine.context.onstatechange = () => {
      if (!state.busy && engine.context.state !== 'running' && state.playing) {
        state.playing = false;
        engine.playing = false;
        engine.setMix(state.mix, state.master);
        syncPlayback();
      }
    };
  } catch (error) { state.playing = false; toast(error.message || 'Sound could not start. Please try again.'); }
  finally { state.busy = false; syncPlayback(); }
}
$$('[data-play]').forEach((button) => button.addEventListener('click', () => setPlaying(!state.playing)));
$$('[data-scene-select]').forEach((button) => button.addEventListener('click', () => { selectScene(button.dataset.sceneSelect); syncPlayback(); }));
$$('[data-cover-scene]').forEach((button) => button.addEventListener('click', () => { selectScene(button.dataset.coverScene); syncPlayback(); }));
['texture', 'depth', 'drift', 'master'].forEach((key) => {
  $('#' + key).addEventListener('input', (event) => {
    const value = clamp(Number(event.target.value));
    if (key === 'master') state.master = value;
    else state.mix[key] = value;
    syncRanges();
    engine.setMix(state.mix, state.master);
    storeSettings();
  });
});
$('#reset-mix').addEventListener('click', () => { state.mix = { ...scenes[state.scene].mix }; syncRanges(); engine.setMix(state.mix, state.master); storeSettings(); announce('Sound layers reset to the ' + scenes[state.scene].name + ' preset.'); });

function syncMotion() {
  sculpture.setPaused(motionPaused);
  $('#motion-toggle').setAttribute('aria-pressed', String(motionPaused));
  $('#motion-toggle').setAttribute('aria-label', motionPaused ? 'Resume visual animation' : 'Pause visual animation');
  $('#motion-label').textContent = motionPaused ? 'Resume motion' : 'Pause motion';
  $('#motion-symbol').textContent = motionPaused ? '▷' : 'Ⅱ';
}
$('#motion-toggle').addEventListener('click', () => { motionPaused = !motionPaused; syncMotion(); });
motionQuery.addEventListener('change', (event) => { motionPaused = event.matches; syncMotion(); });

// Native dialogs provide modal focus containment, Escape, and focus restoration.
$$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
$('#about-button').addEventListener('click', () => $('#about-dialog').showModal());
$('#save-mix').addEventListener('click', () => {
  if (savedMixes.length >= 12) { toast('Your collection holds 12 mixes. Remove one to make a little room.'); return; }
  $('#save-form').reset();
  $('#save-error').textContent = '';
  $('#mix-name').setCustomValidity('');
  $('#save-dialog').showModal();
  $('#mix-name').focus();
});
$('#mix-name').addEventListener('input', () => { $('#mix-name').setCustomValidity(''); $('#save-error').textContent = ''; });
$('#save-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#mix-name').value.trim();
  if (!name) { $('#save-error').textContent = 'Give this state a name first.'; $('#mix-name').focus(); return; }
  const entry = { id: crypto.randomUUID(), name: name.slice(0, 40), scene: state.scene, mix: { ...state.mix }, master: state.master };
  const updated = [...savedMixes, entry];
  try { localStorage.setItem(MIXES_KEY, JSON.stringify(updated)); }
  catch { $('#save-error').textContent = 'This browser can’t save locally. Allow site storage and try again.'; return; }
  savedMixes = updated;
  renderCollection();
  $('#save-dialog').close();
  toast('“' + entry.name + '” is yours to come back to.');
});

function renderCollection() {
  const container = $('#saved-mixes');
  container.replaceChildren();
  $('#collection-empty').hidden = savedMixes.length > 0;
  $('#collection-count').textContent = String(savedMixes.length).padStart(2, '0');
  savedMixes.forEach((mix) => {
    const card = document.createElement('article');
    card.className = 'saved-card';
    const top = document.createElement('div');
    top.className = 'saved-card-top';
    const swatch = document.createElement('span');
    swatch.className = 'scene-swatch ' + mix.scene + '-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    const remove = document.createElement('button');
    remove.className = 'delete-mix';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + mix.name);
    remove.addEventListener('click', () => {
      const updated = savedMixes.filter((entry) => entry.id !== mix.id);
      try { localStorage.setItem(MIXES_KEY, JSON.stringify(updated)); }
      catch { toast('This browser could not update your collection. Please try again.'); return; }
      const index = savedMixes.findIndex((entry) => entry.id === mix.id);
      savedMixes = updated;
      renderCollection();
      const next = $$('.delete-mix')[Math.min(index, savedMixes.length - 1)];
      (next || $('.collection-empty .circle-link')).focus({ preventScroll: true });
      toast('“' + mix.name + '” removed from this device.');
    });
    top.append(swatch, remove);
    const heading = document.createElement('h3');
    heading.textContent = mix.name;
    const details = document.createElement('p');
    details.textContent = scenes[mix.scene].name.toUpperCase() + ' / ' + mix.mix.texture + ' · ' + mix.mix.depth + ' · ' + mix.mix.drift;
    const load = document.createElement('button');
    load.className = 'load-mix';
    load.type = 'button';
    load.append(document.createTextNode('Return to this state'));
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    load.append(arrow);
    load.setAttribute('aria-label', 'Load ' + mix.name);
    load.addEventListener('click', () => {
      state.mix = { ...mix.mix };
      state.master = clamp(mix.master, 55);
      selectScene(mix.scene, false);
      syncPlayback();
      $('#room').scrollIntoView({ behavior: motionQuery.matches ? 'instant' : 'smooth' });
      $('#main-play').focus({ preventScroll: true });
      toast('“' + mix.name + '” loaded. ' + (state.playing ? 'Make yourself at home.' : 'Press play when you’re ready.'));
    });
    card.append(top, heading, details, load);
    container.append(card);
  });
}

// The focus timer uses wall-clock time so background throttling cannot add minutes.
let duration = 25;
let remaining = duration * 60;
let endAt = 0;
let timerInterval = null;
let timerRunning = false;
let timerStarted = false;
function renderTimer() {
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  $('#timer-display').replaceChildren(document.createTextNode(String(minutes).padStart(2, '0')));
  const colon = document.createElement('span'); colon.textContent = ':';
  $('#timer-display').append(colon, document.createTextNode(String(seconds).padStart(2, '0')));
  $('#timer-display').setAttribute('aria-label', minutes + ' minutes and ' + seconds + ' seconds remaining');
  $('#timer-toggle').firstChild.textContent = timerRunning ? 'Pause this moment ' : timerStarted && remaining > 0 ? 'Continue your moment ' : 'Start a moment ';
  const percent = Math.round((1 - remaining / (duration * 60)) * 100);
  $('.timer-progress').setAttribute('aria-valuenow', String(percent));
  $('#timer-progress-fill').style.width = percent + '%';
  $('#timer-caption').textContent = timerRunning ? 'Everything else can wait.' : timerStarted && remaining > 0 ? 'A pause within a pause.' : remaining === 0 ? 'A little more here. A little more you.' : 'Your next little reset.';
}
function tickTimer() {
  if (!timerRunning) return;
  remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  if (remaining === 0) {
    timerRunning = false;
    timerStarted = false;
    clearInterval(timerInterval);
    toast('Your moment is complete. Come back at your own pace.');
    announce('Focus session complete. Your soundscape will keep playing.');
  }
  renderTimer();
}
$('#timer-toggle').addEventListener('click', () => {
  if (timerRunning) {
    tickTimer();
    timerRunning = false;
    clearInterval(timerInterval);
    announce('Focus timer paused.');
  } else {
    if (remaining === 0) remaining = duration * 60;
    endAt = Date.now() + remaining * 1000;
    timerRunning = true;
    timerStarted = true;
    timerInterval = setInterval(tickTimer, 250);
    announce(duration + ' minute focus timer started.');
  }
  renderTimer();
});
function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerStarted = false;
  remaining = duration * 60;
  renderTimer();
}
$('#timer-reset').addEventListener('click', () => { resetTimer(); announce('Focus timer reset.'); });
$$('[data-duration]').forEach((button) => button.addEventListener('click', () => {
  duration = Number(button.dataset.duration);
  resetTimer();
  $$('[data-duration]').forEach((option) => { const active = option === button; option.classList.toggle('active', active); option.setAttribute('aria-pressed', String(active)); });
  announce('Focus duration set to ' + duration + ' minutes.');
}));
document.addEventListener('visibilitychange', () => { if (!document.hidden) tickTimer(); });

function closeMenu() { $('.menu-toggle').setAttribute('aria-expanded', 'false'); $('.menu-toggle').setAttribute('aria-label', 'Open navigation'); $('#mobile-nav').hidden = true; }
$('.menu-toggle').addEventListener('click', () => {
  const open = $('.menu-toggle').getAttribute('aria-expanded') === 'true';
  $('.menu-toggle').setAttribute('aria-expanded', String(!open));
  $('.menu-toggle').setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
  $('#mobile-nav').hidden = open;
});
$$('#mobile-nav a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#mobile-nav').hidden) { closeMenu(); $('.menu-toggle').focus(); } });
document.addEventListener('click', (event) => { if (!$('.site-header').contains(event.target)) closeMenu(); });
matchMedia('(min-width: 601px)').addEventListener('change', (event) => { if (event.matches) closeMenu(); });

selectScene(state.scene, false, false);
syncPlayback();
syncMotion();
renderCollection();
renderTimer();
