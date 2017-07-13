// tslint:disable no-floating-promises

import * as PouchDB from 'pouchdb';
import * as PouchDBAdapterMemory from 'pouchdb-adapter-memory';
import { Action } from 'redux';
import createMockStore, { MockStore } from 'redux-mock-store';

import * as sync from '../index';

PouchDB.plugin(PouchDBAdapterMemory);

const kind = 'kind';

let db: PouchDB.Database;
let remoteDb: PouchDB.Database;
let store: MockStore<{}>;
let models: sync.SyncModel[];
const now = new Date();

function lastAction() {
  const actions: Action[] = store.getActions();

  return actions[actions.length - 1];
}

beforeEach(async done => {
  models = [
    { kind: kind, _id: '1234', value: 1234, createdAt: now, modifiedAt: now },
    { kind: kind, _id: '2345', value: 2345, createdAt: now, modifiedAt: now },
    { kind: kind, _id: '3456', value: 3456, createdAt: now, modifiedAt: now },
  ];
  db = new PouchDB<sync.MaybeModel>('test', { adapter: 'memory' });
  remoteDb = new PouchDB<sync.MaybeModel>('test-remote', { adapter: 'memory' });
  const replication = db.sync(remoteDb, { live: true, retry: true });

  await db.bulkDocs(models);

  const middlewares = [sync.sync(db, replication, [kind], 'test', done)];
  store = createMockStore(middlewares)();
});

afterEach(async () => {
  await db.destroy();
  await remoteDb.destroy();
});

describe('initialization', () => {
  it('should dispatch initialized', () => {
    const actions = store.getActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions).toContainEqual({
      meta: { name: 'test' },
      type: sync.INITIALIZED,
    });
  });

  it('should dispatch load_models', async () => {
    const actions = store.getActions();
    const storedModels = await Promise.all(
      models.map(async m => db.get(m._id))
    );
    expect(actions.length).toBeGreaterThan(0);
    expect(actions).toContainEqual({
      type: sync.LOAD_MODELS,
      meta: { kind: kind },
      payload: storedModels,
    });
    expect(actions).toContainEqual({
      type: sync.MODEL_INITIALIZED,
      meta: { kind: kind },
    });
  });

  it('should dispatch model_initialized', () => {
    const actions = store.getActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions).toContainEqual({
      type: sync.MODEL_INITIALIZED,
      meta: { kind: kind },
    });
  });
});

describe('inserting', () => {
  it('should handle an insert action', async () => {
    const model = {
      kind: kind,
      _id: '0123',
      value: 123,
      createdAt: now,
      modifiedAt: now,
    };
    store.clearActions();
    store.dispatch(sync.insertModel(model));

    const doc = await db.get('0123');
    expect(doc).toMatchObject({ _id: model._id, value: 123 });
    expect(store.getActions().length).toBe(0);
  });

  it('should handle duplicate an insert action', async () => {
    const model = {
      kind: kind,
      _id: '0123',
      value: 123,
      createdAt: now,
      modifiedAt: now,
    };
    store.dispatch(sync.insertModel(model));

    const doc1 = await db.get('0123');
    store.dispatch(sync.insertModel({ ...model, ...doc1, value: 234 }));
    const doc2 = await db.get('0123');
    expect(doc2).toMatchObject({ _id: model._id, value: 234 });
  });

  it('should handle an bulk insert action', async () => {
    const modelsToInsert = [
      { kind: kind, _id: '0123', value: 123, createdAt: now, modifiedAt: now },
      {
        kind: kind,
        _id: '1234',
        value: 1234,
        createdAt: now,
        modifiedAt: now,
      },
    ];
    store.dispatch(sync.insertBulkModels(modelsToInsert, kind));

    const doc1 = await db.get('0123');
    const doc2 = await db.get('1234');

    expect(doc1).toMatchObject({
      kind: kind,
      _id: '0123',
      value: 123,
    });
    expect(doc2).toMatchObject({
      kind: kind,
      _id: '1234',
      value: 1234,
    });
  });
});

describe('updating', () => {
  it('should handle an insert and update action', async () => {
    const model = {
      kind: kind,
      _id: '0123',
      value: 123,
      createdAt: now,
      modifiedAt: now,
    };
    store.dispatch(sync.insertModel(model));

    const doc1 = await db.get('0123');
    store.dispatch(sync.updateModel({ ...model, ...doc1, value: 234 }));
    const doc2 = await db.get('0123');
    expect(doc2).toMatchObject({ _id: model._id, value: 234 });
  });

  it('should handle an update action without a previous insert', async () => {
    const model = {
      kind: kind,
      _id: '0123',
      value: 123,
      createdAt: now,
      modifiedAt: now,
    };
    store.clearActions();
    store.dispatch(sync.updateModel(model));
    const doc = await db.get('0123');
    expect(doc).toMatchObject({ _id: model._id, value: 123 });
    expect(store.getActions().length).toBe(0);
  });

  it('should handle an bulk update action', async () => {
    const modelsToInsert = [
      { kind: kind, _id: '0123', value: 123, createdAt: now, modifiedAt: now },
      { kind: kind, _id: '1234', value: 1234, createdAt: now, modifiedAt: now },
    ];
    store.dispatch(sync.insertBulkModels(modelsToInsert, kind));

    {
      const doc1 = await db.get('0123');
      const doc2 = await db.get('1234');

      const modelsToUpdate = [
        { ...doc1, kind: kind, value: 321, createdAt: now, modifiedAt: now },
        { ...doc2, kind: kind, value: 4321, createdAt: now, modifiedAt: now },
      ];
      store.dispatch(sync.updateBulkModels(modelsToUpdate, kind));
    }
    const doc1 = await db.get('0123');
    const doc2 = await db.get('1234');

    expect(doc1).toMatchObject({ kind: kind, _id: '0123', value: 321 });
    expect(doc2).toMatchObject({ kind: kind, _id: '1234', value: 4321 });
  });

  it('should handle an bulk update action without previous insert', async () => {
    const modelsToUpdate = [
      { kind: kind, _id: '0123', value: 123, createdAt: now, modifiedAt: now },
      { kind: kind, _id: '1234', value: 1234, createdAt: now, modifiedAt: now },
    ];
    store.dispatch(sync.updateBulkModels(modelsToUpdate, kind));

    const doc1 = await db.get('0123');
    const doc2 = await db.get('1234');

    expect(doc1).toMatchObject({ kind: kind, _id: '0123', value: 123 });
    expect(doc2).toMatchObject({ kind: kind, _id: '1234', value: 1234 });
  });
});

describe('removing', () => {
  it('should handle an insert and remove action', async () => {
    const model = {
      kind: kind,
      _id: '0123',
      value: 123,
      createdAt: now,
      modifiedAt: now,
    };
    store.dispatch(sync.insertModel(model));

    const doc1 = await db.get('0123', { revs: true });
    store.dispatch(
      sync.removeModel({ _id: doc1._id, _rev: doc1._rev as string }, kind)
    );
    try {
      await db.get('0123');
      fail('Should not be able to retrieve a removed model');
    } catch (err) {
      expect(err).toMatchObject({
        status: 404,
        name: 'not_found',
        message: 'missing',
        error: true,
        reason: 'deleted',
      });
    }
  });

  it('should handle an remove action without a previous insert', async () => {
    const model = {
      kind: kind,
      _id: '0123',
      value: 123,
      createdAt: now,
      modifiedAt: now,
    };
    store.clearActions();
    store.dispatch(sync.removeModel({ _id: model._id, _rev: '' }, kind));

    try {
      await db.get('0123');
      fail('Should not be able to retrieve a removed model');
    } catch (err) {
      expect(err).toMatchObject({
        status: 404,
        name: 'not_found',
        message: 'missing',
        error: true,
        reason: 'missing',
      });
    }
  });

  it('should handle an bulk remove action', async () => {
    const modelsToInsert = [
      { kind: kind, _id: '0123', value: 123, createdAt: now, modifiedAt: now },
      { kind: kind, _id: '1234', value: 1234, createdAt: now, modifiedAt: now },
    ];
    store.dispatch(sync.insertBulkModels(modelsToInsert, kind));

    const doc1 = await db.get('0123');
    const doc2 = await db.get('1234');

    const modelsToRemove = [
      { _id: doc1._id, _rev: doc1._rev as string },
      { _id: doc2._id, _rev: doc2._rev as string },
    ];
    store.dispatch(sync.removeBulkModels(modelsToRemove, kind));

    try {
      await db.get('0123');
    } catch (err) {
      expect(err).toMatchObject({
        status: 404,
        name: 'not_found',
        message: 'missing',
        error: true,
        reason: 'deleted',
      });
    }
    try {
      await db.get('1234');
    } catch (err) {
      expect(err).toMatchObject({
        status: 404,
        name: 'not_found',
        message: 'missing',
        error: true,
        reason: 'deleted',
      });
    }
  });
});

describe('syncing', () => {
  it('should handle an insert in the remote database', async () => {
    store.clearActions();
    const model = {
      kind: kind,
      _id: '0123',
      value: 123,
      createdAt: now,
      modifiedAt: now,
    };
    await remoteDb.put(model);

    await (db.sync(remoteDb) as Promise<void>);
    const doc = await db.get('0123');

    const actions = store.getActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions).toContainEqual({
      type: sync.INSERT_BULK_MODELS,
      meta: { kind: kind, fromSync: true },
      payload: [doc],
    });
  });

  it('should handle an insert and update in the remote database', async () => {
    store.clearActions();

    const model = { kind: kind, _id: '0123', value: 123 };
    await remoteDb.put(model);
    await (db.sync(remoteDb) as Promise<void>);

    store.clearActions();

    let doc = await remoteDb.get('0123');

    await remoteDb.put({
      _id: doc._id,
      _rev: doc._rev,
      kind: kind,
      value: 234,
    });
    await (db.sync(remoteDb) as Promise<void>);
    doc = await db.get('0123');

    expect(lastAction()).toMatchObject({
      type: sync.UPDATE_BULK_MODELS,
      meta: { kind: kind, fromSync: true },
      payload: [{ ...doc }],
    });
  });

  it('should handle an insert and remove in the remote database', async () => {
    store.clearActions();

    const model = { kind: kind, _id: '0123', value: 123 };
    await remoteDb.put(model);
    await (db.sync(remoteDb) as Promise<void>);

    store.clearActions();

    let doc = await remoteDb.get('0123');

    await remoteDb.put({
      _id: doc._id,
      _rev: doc._rev,
      kind: kind,
      value: 234,
    });
    await (db.sync(remoteDb) as Promise<void>);
    doc = await db.get('0123');

    expect(lastAction()).toMatchObject({
      type: sync.UPDATE_BULK_MODELS,
      meta: { kind: kind, fromSync: true },
      payload: [{ ...doc }],
    });

    await remoteDb.remove({ _id: doc._id, _rev: doc._rev as string });
    await (db.sync(remoteDb) as Promise<void>);

    expect(lastAction()).toMatchObject({
      type: sync.REMOVE_BULK_MODELS,
      meta: { kind: kind, fromSync: true },
      payload: [{ _id: doc._id }],
    });
  });
});
