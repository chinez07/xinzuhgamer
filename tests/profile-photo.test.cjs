// JavaScript / tests/profile-photo.test.cjs / Node.js 18+ / Bloxzuh.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const custom = 'data:image/jpeg;base64,Y3VzdG9t';
const google = 'https://example.test/google.jpg';
const user = {uid: 'alice', photoURL: google, displayName: 'Alice', email: 'alice@example.test'};

function photos(profile, stored = {}, readError = null) {
  const storage = new Map(Object.entries(stored));
  const writes = [];
  const sandbox = vm.createContext({
    window: {}, console: {warn() {}},
    firebase: {auth: () => ({currentUser: user})},
    localStorage: {getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k)},
    fsGetProfile: async () => {if (readError) throw readError; return profile;},
    fsSaveProfile: async data => {writes.push(data);}
  });
  vm.runInContext(read('js/photos.js'), sandbox);
  return {api: sandbox.window.BloxzuhPhotos, storage, writes};
}

test('A fresh device loads the cloud custom photo instead of the Google photo', async () => {
  const {api, storage, writes} = photos({photo: custom, photoSource: 'custom'});
  assert.equal(await api.syncMyPhoto(user), custom);
  assert.equal(storage.get('xinzuh-photo-alice'), custom);
  assert.equal(storage.get('xinzuh-photo'), custom);
  assert.equal(storage.get('xinzuh-photo-custom-alice'), '1');
  assert.equal(writes.length, 0);
});

test('Cloud photo replaces stale Google cache on another device', async () => {
  const {api} = photos({photo: custom}, {'xinzuh-photo-alice': google});
  assert.equal(await api.syncMyPhoto(user), custom);
  assert.equal(api.cache.alice, custom);
});

test('An old custom photo can be recovered from the original device', async () => {
  const {api, writes} = photos({photo: ''}, {'xinzuh-photo-alice': custom, 'xinzuh-photo-custom-alice': '1'});
  assert.equal(await api.syncMyPhoto(user), custom);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].photo, custom);
  assert.equal(writes[0].photoSource, 'custom');
});

test('A cloud read failure never overwrites the profile with Google or stale local data', async () => {
  const {api, writes} = photos(null, {'xinzuh-photo-alice': custom, 'xinzuh-photo-custom-alice': '1'}, Error('offline'));
  assert.equal(await api.syncMyPhoto(user), custom);
  assert.equal(writes.length, 0);
});

test('Saving a new photo updates the memory cache used by listings', async () => {
  const {api} = photos({photo: google});
  await api.fetch('alice');
  api.setLocal('alice', custom, true);
  assert.equal(await api.fetch('alice'), custom);
});

test('A delayed cloud response cannot replace a newly saved photo', async () => {
  const {api} = photos({photo: google});
  const pending = api.syncMyPhoto(user);
  api.setLocal('alice', custom, true);
  assert.equal(await pending, custom);
  assert.equal(api.cache.alice, custom);
});

function profileWriter(existing) {
  let saved;
  const ref = {get: async () => ({exists: true, data: () => existing}), set: async value => {saved = {...existing, ...value};}};
  const sandbox = vm.createContext({
    requireUser: () => user,
    firebase: {firestore: {FieldValue: {serverTimestamp: () => 'server-time'}}},
    getDb: () => ({collection: name => {
      if (name === 'profiles') return {doc: () => ref};
      return {where: () => ({limit: () => ({get: async () => ({forEach() {}})})})};
    }, batch: () => ({})}), console
  });
  const source = read('js/firestore-db.js');
  vm.runInContext(source.slice(source.indexOf('async function fsSaveProfile('), source.indexOf('async function fsGetProfile(')), sandbox);
  return {save: sandbox.fsSaveProfile, result: () => saved};
}

test('A partial profile update preserves existing photo and biography', async () => {
  const {save, result} = profileWriter({photo: custom, bio: 'Minha bio', memberSinceMs: 1});
  await save({displayName: 'Alice nova'});
  assert.equal(result().photo, custom);
  assert.equal(result().bio, 'Minha bio');
});

test('A photo update preserves the biography and stores custom source', async () => {
  const {save, result} = profileWriter({photo: google, bio: 'Minha bio', memberSinceMs: 1});
  await save({photo: custom, photoSource: 'custom'});
  assert.equal(result().photo, custom);
  assert.equal(result().photoSource, 'custom');
  assert.equal(result().bio, 'Minha bio');
});

test('The former numeric-zero photo write is rejected without changing the profile', async () => {
  const {save, result} = profileWriter({photo: custom});
  await assert.rejects(save({photo: 0}), /Valor inválido/);
  assert.equal(result(), undefined);
});

function photoForm() {
  const html = read('conta.html');
  const render = html.slice(html.indexOf('    function renderAvatar('), html.indexOf('    async function fillForm('));
  const handler = html.slice(html.indexOf("    document.getElementById('photoInput').addEventListener('change'"), html.indexOf("    document.getElementById('btnSaveProfile').addEventListener"));
  let onChange, resolveSave, rejectSave;
  const saving = new Promise((resolve, reject) => {resolveSave = resolve; rejectSave = reject;});
  const avatar = {tagName: 'IMG', src: google, getAttribute() {return this.src;}};
  const input = {files: [{size: 100, type: 'image/png'}], disabled: false, value: 'photo.png', addEventListener(event, fn) {onChange = fn;}};
  const messages = [];
  // Simulate an older cached photos.js: the memory cache still has the old photo.
  const api = {cache: {alice: google}, setLocal() {}};
  const sandbox = vm.createContext({
    window: {BloxzuhPhotos: api}, BloxzuhPhotos: api,
    auth: {currentUser: user}, console: {error() {}},
    localStorage: {getItem: () => google},
    document: {getElementById: id => ({avatarBox: avatar, photoInput: input, username: {value: 'Alice'}}[id])},
    uploadProfilePhoto: async () => custom,
    fsSaveProfile: () => saving,
    msg: (text, type) => messages.push({text, type})
  });
  vm.runInContext(render + '\n' + handler, sandbox);
  return {change: () => onChange({target: input}), resolveSave, rejectSave, avatar, input, messages};
}

test('Selected photo appears before cloud save finishes and survives a stale memory cache', async () => {
  const form = photoForm();
  const pending = form.change();
  await new Promise(setImmediate);
  assert.equal(form.avatar.src, custom);
  assert.equal(form.input.disabled, true);
  assert.equal(form.messages.at(-1).text, 'Salvando foto…');
  form.resolveSave();
  await pending;
  assert.equal(form.avatar.src, custom);
  assert.equal(form.messages.at(-1).text, 'Foto salva com sucesso!');
  assert.equal(form.input.disabled, false);
});

test('A failed cloud save restores the previous avatar and unlocks file selection', async () => {
  const form = photoForm();
  const pending = form.change();
  await new Promise(setImmediate);
  assert.equal(form.avatar.src, custom);
  form.rejectSave(Error('Sem conexão'));
  await pending;
  assert.equal(form.avatar.src, google);
  assert.equal(form.input.disabled, false);
  assert.equal(form.input.value, '');
  assert.equal(form.messages.at(-1).type, 'err');
});
