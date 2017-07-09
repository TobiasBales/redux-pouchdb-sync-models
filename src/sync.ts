import { Action, Dispatch, Middleware, MiddlewareAPI } from 'redux';
import { ThunkAction } from 'redux-thunk';

import * as actions from './actions';
import {
  OPERATION_BULK_INSERT,
  OPERATION_BULK_REMOVE,
  OPERATION_BULK_UPDATE,
  OPERATION_FETCH_DOCS,
  OPERATION_INSERT,
  OPERATION_REMOVE,
  OPERATION_UPDATE,
} from './constants';

type ModelStorage = { [k: string]: actions.SyncModel[] };
type IDStorage = { [k: string]: string };

const changeCallback = (
  api: MiddlewareAPI<{}>,
  knownIDs: IDStorage,
  modelsToSync?: string[]
) => (result: PouchDB.Replication.SyncResult<actions.MaybeModel>): void => {
  if (result.direction === 'push') {
    return;
  }

  const models: {
    [k: string]: {
      insert: actions.SyncModel[];
      update: actions.SyncModel[];
      remove: { _id: string; _rev: string }[];
    };
  } = {};

  result.change.docs.forEach(doc => {
    if (actions.isDeletedDoc(doc) && knownIDs[doc._id] !== undefined) {
      const kind = knownIDs[doc._id];
      if (models[kind] === undefined) {
        models[kind] = { insert: [], update: [], remove: [] };
      }
      models[kind].remove.push(doc);
      // api.dispatch(removeModel(doc, knownIDs[doc._id], true));
      delete knownIDs[doc._id];

      return;
    }

    if (!actions.isModelToSync(doc, modelsToSync)) {
      return;
    }

    const kind = doc.kind;
    if (models[kind] === undefined) {
      models[kind] = { insert: [], update: [], remove: [] };
    }

    if (knownIDs[doc._id] === undefined) {
      models[kind].insert.push(doc);
      knownIDs[doc._id] = doc.kind;
    } else {
      models[kind].update.push(doc);
    }
  });

  Object.keys(models).forEach(kind => {
    if (models[kind].insert.length > 0) {
      api.dispatch(actions.insertBulkModels(models[kind].insert, kind, true));
    }
    if (models[kind].update.length > 0) {
      api.dispatch(actions.updateBulkModels(models[kind].update, kind, true));
    }
    if (models[kind].remove.length > 0) {
      api.dispatch(actions.removeBulkModels(models[kind].remove, kind, true));
    }
  });
};

const fetchDocuments = async (
  db: PouchDB.Database<actions.MaybeModel>,
  api: MiddlewareAPI<{}>,
  knownIDs: IDStorage,
  modelsToSync?: string[],
  name?: string,
  done?: () => void
) => {
  const response = await db.allDocs({ include_docs: true });
  const docs = response.rows.map(row => row.doc);
  const models: ModelStorage = {};

  docs.forEach(doc => {
    if (!actions.isModelToSync(doc, modelsToSync)) {
      return;
    }

    if (models[doc.kind] === undefined) {
      models[doc.kind] = [];
    }

    models[doc.kind].push(doc);
    knownIDs[doc._id] = doc.kind;
  });

  Object.keys(models).forEach(kind => {
    api.dispatch(actions.loadModels(models[kind], kind));
    api.dispatch(actions.modelInitialized(kind));
  });
  api.dispatch(actions.initialized(name));
  if (done !== undefined) {
    done();
  }
};

export type ChangeCallback = (
  arg: PouchDB.Replication.SyncResult<actions.MaybeModel>
) => void;

const insertDocument = async (
  db: PouchDB.Database<actions.MaybeModel>,
  knownIDs: IDStorage,
  action: actions.InsertModel<actions.SyncModel>
) => {
  await db.put(
    action.payload.toJSON !== undefined
      ? action.payload.toJSON()
      : action.payload
  );

  const doc = await db.get(action.payload._id);
  if (!actions.isModel(doc)) {
    return action;
  }

  knownIDs[action.payload._id] = action.payload.kind;
  action.payload = doc;

  return action;
};

function isBulkGetOK(doc: {}): doc is { ok: actions.SyncModel } {
  return 'ok' in doc && actions.isModel(doc);
}

const insertBulkDocuments = async (
  db: PouchDB.Database<actions.MaybeModel>,
  knownIDs: IDStorage,
  action: actions.InsertBulkModels<actions.SyncModel>
) => {
  const data = action.payload.map(
    m => (m.toJSON !== undefined ? m.toJSON() as actions.SyncModel : m)
  );
  await db.bulkDocs(data);
  const ids = data.map(d => {
    return { id: d._id, rev: '' };
  });

  const resp = await db.bulkGet({ docs: ids });
  const docs = resp.results.docs.filter(d => actions.isModel(d));
  const models: actions.SyncModel[] = [];

  docs.forEach(d => {
    if (!isBulkGetOK(d)) {
      return;
    }

    knownIDs[d.ok._id] = d.ok.kind;
    models.push(d.ok);
  });

  action.payload = models;

  return action;
};

const updateDocument = async (
  db: PouchDB.Database<actions.MaybeModel>,
  action: actions.UpdateModel<actions.SyncModel>
) => {
  await db.put(
    action.payload.toJSON !== undefined
      ? action.payload.toJSON()
      : action.payload
  );

  const doc = await db.get(action.payload._id);
  if (!actions.isModel(doc)) {
    return action;
  }
  action.payload = doc;

  return action;
};

const updateBulkDocuments = async (
  db: PouchDB.Database<actions.MaybeModel>,
  knownIDs: IDStorage,
  action: actions.UpdateBulkModels<actions.SyncModel>
) => {
  const data = action.payload.map(
    m => (m.toJSON !== undefined ? m.toJSON() as actions.SyncModel : m)
  );
  await db.bulkDocs(data);
  const ids = data.map(d => {
    return { id: d._id, rev: '' };
  });

  const resp = await db.bulkGet({ docs: ids });
  const docs = resp.results.docs.filter(d => actions.isModel(d));
  const models: actions.SyncModel[] = [];

  docs.forEach(d => {
    if (!isBulkGetOK(d)) {
      return;
    }

    knownIDs[d.ok._id] = d.ok.kind;
    models.push(d.ok);
  });

  action.payload = models;

  return action;
};

const removeDocument = async (
  db: PouchDB.Database<actions.MaybeModel>,
  knownIDs: IDStorage,
  action: actions.RemoveModel
) => {
  await db.remove(action.payload);
  delete knownIDs[action.payload._id];

  return action;
};

const removeBulkDocuments = async (
  db: PouchDB.Database<actions.MaybeModel>,
  knownIDs: IDStorage,
  action: actions.RemoveBulkModels
) => {
  await Promise.all(action.payload.map(async d => db.remove(d)));
  action.payload.map(d => {
    delete knownIDs[d._id];
  });

  return action;
};

export interface ReplicationNotifier {
  on(
    event: 'change',
    listener: (info: PouchDB.Replication.SyncResult<actions.MaybeModel>) => void
  ): ReplicationNotifier;
}

// tslint:disable max-func-body-length
export function sync<State>(
  db: PouchDB.Database<actions.MaybeModel>,
  replication?: ReplicationNotifier,
  modelsToSync?: string[],
  name?: string,
  done?: () => void
): Middleware {
  const knownIDs: IDStorage = {};

  return (api: MiddlewareAPI<State>) => {
    return (next: Dispatch<State>) => {
      if (replication !== undefined) {
        replication.on('change', changeCallback(api, knownIDs, modelsToSync));
      }

      fetchDocuments(db, api, knownIDs, modelsToSync, name, done).catch(err => {
        api.dispatch(actions.modelError(err as Error, OPERATION_FETCH_DOCS));
        if (done !== undefined) {
          done();
        }
      });

      return (action: Action | ThunkAction<{}, State, {}>) => {
        if (
          actions.isFromSync(action) ||
          !actions.isAction(action) ||
          !actions.hasMeta(action) ||
          !actions.isModelToSync(action.meta, modelsToSync)
        ) {
          next(action as ThunkAction<{}, State, {}>);

          return;
        }

        if (actions.isInsertAction(action)) {
          insertDocument(db, knownIDs, action).then(next).catch(err => {
            api.dispatch(actions.modelError(err as Error, OPERATION_INSERT));
          });

          return;
        }

        if (actions.isBulkInsertAction(action)) {
          insertBulkDocuments(db, knownIDs, action).then(next).catch(err => {
            api.dispatch(
              actions.modelError(err as Error, OPERATION_BULK_INSERT)
            );
          });

          return;
        }

        if (actions.isUpdateAction(action)) {
          updateDocument(db, action).then(next).catch(err => {
            api.dispatch(actions.modelError(err as Error, OPERATION_UPDATE));
          });

          return;
        }

        if (actions.isBulkUpdateAction(action)) {
          updateBulkDocuments(db, knownIDs, action).then(next).catch(err => {
            api.dispatch(
              actions.modelError(err as Error, OPERATION_BULK_UPDATE)
            );
          });

          return;
        }

        if (actions.isRemoveAction(action)) {
          removeDocument(db, knownIDs, action).then(next).catch(err => {
            api.dispatch(actions.modelError(err as Error, OPERATION_REMOVE));
          });

          return;
        }

        if (actions.isBulkRemoveAction(action)) {
          removeBulkDocuments(db, knownIDs, action).then(next).catch(err => {
            api.dispatch(
              actions.modelError(err as Error, OPERATION_BULK_REMOVE)
            );
          });

          return;
        }

        // tslint:disable-next-line no-any
        next((action as any) as ThunkAction<{}, State, {}>);
      };
    };
  };
}
// tslint:enable max-func-body-length
