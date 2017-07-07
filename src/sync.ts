import { Action, Dispatch, Middleware, MiddlewareAPI } from 'redux';
import { ThunkAction } from 'redux-thunk';
import { RemoveModel, UpdateModel } from './actions';

import {
  hasMeta,
  initialized,
  insertModel,
  InsertModel,
  isAction,
  isDeletedDoc,
  isFromSync,
  isInsertAction,
  isModel,
  isModelToSync,
  isRemoveAction,
  isUpdateAction,
  loadModels,
  MaybeModel,
  modelError,
  modelInitialized,
  OPERATION_FETCH_DOCS,
  OPERATION_INSERT,
  OPERATION_REMOVE,
  OPERATION_UPDATE,
  removeModel,
  SyncModel,
  updateModel,
} from './actions';

type ModelStorage = { [k: string]: SyncModel[] };
type IDStorage = { [k: string]: string };

const changeCallback = (
  api: MiddlewareAPI<{}>,
  knownIDs: IDStorage,
  modelsToSync?: string[]
) => (result: PouchDB.Replication.SyncResult<MaybeModel>): void => {
  if (result.direction === 'push') {
    return;
  }

  result.change.docs.forEach(doc => {
    if (!isModelToSync(doc, modelsToSync)) {
      return;
    }

    if (isDeletedDoc(doc) && knownIDs[doc._id] !== undefined) {
      api.dispatch(removeModel(doc, knownIDs[doc._id], true));
      delete knownIDs[doc._id];

      return;
    }

    if (knownIDs[doc._id] === undefined) {
      api.dispatch(insertModel(doc, true));
      knownIDs[doc._id] = doc.kind;
    } else {
      api.dispatch(updateModel(doc, true));
    }
  });
};

const fetchDocuments = async (
  db: PouchDB.Database<MaybeModel>,
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
    if (!isModelToSync(doc, modelsToSync)) {
      return;
    }

    if (models[doc.kind] === undefined) {
      models[doc.kind] = [];
    }

    models[doc.kind].push(doc);
    knownIDs[doc._id] = doc.kind;
  });

  Object.keys(models).forEach(kind => {
    api.dispatch(loadModels(models[kind], kind));
    api.dispatch(modelInitialized(kind));
  });
  api.dispatch(initialized(name));
  if (done !== undefined) {
    done();
  }
};

export type ChangeCallback = (
  arg: PouchDB.Replication.SyncResult<MaybeModel>
) => void;

const insertDocument = async (
  db: PouchDB.Database<MaybeModel>,
  knownIDs: IDStorage,
  action: InsertModel<SyncModel>
) => {
  await db.put(
    action.payload.toJSON !== undefined
      ? action.payload.toJSON()
      : action.payload
  );

  const doc = await db.get(action.payload._id);
  if (!isModel(doc)) {
    return action;
  }

  knownIDs[action.payload._id] = action.payload.kind;
  action.payload = doc;

  return action;
};

const updateDocument = async (
  db: PouchDB.Database<MaybeModel>,
  action: UpdateModel<SyncModel>
) => {
  await db.put(
    action.payload.toJSON !== undefined
      ? action.payload.toJSON()
      : action.payload
  );

  const doc = await db.get(action.payload._id);
  if (!isModel(doc)) {
    return action;
  }
  action.payload = doc;

  return action;
};

const removeDocument = async (
  db: PouchDB.Database<MaybeModel>,
  knownIDs: IDStorage,
  action: RemoveModel
) => {
  await db.remove(action.payload);
  delete knownIDs[action.payload._id];

  return action;
};

export interface ReplicationNotifier {
  on(
    event: 'change',
    listener: (info: PouchDB.Replication.SyncResult<MaybeModel>) => void
  ): ReplicationNotifier;
}

// tslint:disable max-func-body-length
export function sync<State>(
  db: PouchDB.Database<MaybeModel>,
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
        api.dispatch(modelError(err as Error, OPERATION_FETCH_DOCS));
        if (done !== undefined) {
          done();
        }
      });

      return (action: Action | ThunkAction<{}, State, {}>) => {
        if (
          isFromSync(action) ||
          !isAction(action) ||
          !hasMeta(action) ||
          !isModelToSync(action.meta, modelsToSync)
        ) {
          next(action as ThunkAction<{}, State, {}>);

          return;
        }

        if (isInsertAction(action)) {
          insertDocument(db, knownIDs, action).then(next).catch(err => {
            api.dispatch(modelError(err as Error, OPERATION_INSERT));
          });

          return;
        }

        if (isUpdateAction(action)) {
          updateDocument(db, action).then(next).catch(err => {
            api.dispatch(modelError(err as Error, OPERATION_UPDATE));
          });

          return;
        }

        if (isRemoveAction(action)) {
          removeDocument(db, knownIDs, action).then(next).catch(err => {
            api.dispatch(modelError(err as Error, OPERATION_REMOVE));
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
