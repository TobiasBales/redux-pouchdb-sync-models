// tslint:disable no-floating-promises

import * as PouchDB from 'pouchdb';
import * as PouchDBAdapterMemory from 'pouchdb-adapter-memory';
import createMockStore, { MockStore } from 'redux-mock-store';

import * as sync from '../index';

PouchDB.plugin(PouchDBAdapterMemory);

const kind = 'kind';

let db: PouchDB.Database;
let remoteDb: PouchDB.Database;
let store: MockStore<{}>;
let models: { kind: string; _id: string; value: number }[];

function justFail(err: Error) {
  fail('Unexpected promise rejection');
}

beforeEach(async done => {
  models = [
    { kind: kind, _id: '1234', value: 1234 },
    { kind: kind, _id: '2345', value: 2345 },
    { kind: kind, _id: '3456', value: 3456 },
  ];
  db = new PouchDB('test', { adapter: 'memory' });
  remoteDb = new PouchDB('test-remote', { adapter: 'memory' });
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
    expect(actions.length).toBe(2);
    expect(actions[1]).toMatchObject({
      meta: { name: 'test' },
      type: sync.INITIALIZED,
    });
  });

  it('should dispatch load_models', () => {
    const actions = store.getActions();
    expect(actions.length).toBe(2);
    expect(actions[0]).toMatchObject({
      type: sync.LOAD_MODELS,
      meta: { kind: kind },
      payload: models,
    });
  });
});

describe('inserting', () => {
  it('should handle an insert action', done => {
    const model = { kind: kind, _id: '0123', value: 123 };
    store.clearActions();
    store.dispatch(sync.insertModel(model));

    db.get('0123').then(doc => {
      expect(doc).toMatchObject(model);
      expect(store.getActions().length).toBe(0);
      done();
    });
  });

  it('should handle duplicate an insert action', done => {
    const model = { kind: kind, _id: '0123', value: 123 };
    store.dispatch(sync.insertModel(model));

    db.get('0123').then(doc1 => {
      store.dispatch(sync.insertModel({ ...model, ...doc1, value: 234 }));
      db.get('0123').then(doc2 => {
        expect(doc2).toMatchObject({ ...model, value: 234 });
        done();
      });
    });
  });
});

describe('updating', () => {
  it('should handle an insert and update action', done => {
    const model = { kind: kind, _id: '0123', value: 123 };
    store.dispatch(sync.insertModel(model));

    db.get('0123').then(doc1 => {
      store.dispatch(sync.updateModel({ ...model, ...doc1, value: 234 }));
      db.get('0123').then(doc2 => {
        expect(doc2).toMatchObject({ ...model, value: 234 });
        done();
      });
    });
  });

  it('should handle an update action without a previous insert', done => {
    const model = { kind: kind, _id: '0123', value: 123 };
    store.clearActions();
    store.dispatch(sync.updateModel(model));

    db.get('0123').then(doc => {
      expect(doc).toMatchObject(model);
      expect(store.getActions().length).toBe(0);
      done();
    });
  });
});

describe('removing', () => {
  it('should handle an insert and remove action', done => {
    const model = { kind: kind, _id: '0123', value: 123 };
    store.dispatch(sync.insertModel(model));

    db.get('0123', { revs: true }).then(doc1 => {
      store.dispatch(
        sync.removeModel({ _id: doc1._id, _rev: doc1._rev as string }, kind)
      );
      db
        .get('0123')
        .then(doc2 => {
          fail('Should not be able to retrieve a removed model');
        })
        .catch(err => {
          expect(err).toMatchObject({
            status: 404,
            name: 'not_found',
            message: 'missing',
            error: true,
            reason: 'deleted',
          });
          done();
        });
    });
  });

  it('should handle an update action without a previous insert', done => {
    const model = { kind: kind, _id: '0123', value: 123 };
    store.clearActions();
    store.dispatch(sync.removeModel({ _id: model._id, _rev: '' }, kind));

    db
      .get('0123')
      .then(doc => {
        fail('Should not be able to retrieve a removed model');
      })
      .catch(err => {
        expect(err).toMatchObject({
          status: 404,
          name: 'not_found',
          message: 'missing',
          error: true,
          reason: 'missing',
        });
        done();
      });
  });
});
