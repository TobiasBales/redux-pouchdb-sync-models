import { Action, Dispatch, Middleware, MiddlewareAPI } from 'redux';
import { ThunkAction } from 'redux-thunk';

import {
  hasMeta,
  initialized,
  insertModel,
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
) => (result: PouchDB.Replication.SyncResult<MaybeModel>) => {
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

const fetchDocuments = (
  db: PouchDB.Database<MaybeModel>,
  api: MiddlewareAPI<{}>,
  knownIDs: IDStorage,
  modelsToSync?: string[]
) => {
  db
    .allDocs({ include_docs: true })
    .then(response => {
      const docs = response.rows.map(row => row.doc);
      const models: ModelStorage = {};

      docs.forEach(doc => {
        if (!isModelToSync(doc, modelsToSync)) {
          return;
        }

        if (models[doc.kind] !== undefined) {
          models[doc.kind] = [];
        }

        models[doc.kind].push(doc);
        knownIDs[doc._id] = doc.kind;
      });

      Object.keys(models).forEach(kind => {
        api.dispatch(loadModels(models[kind], kind));
      });
      api.dispatch(initialized(name));
    })
    .catch(error => {
      api.dispatch(modelError(error as Error, OPERATION_FETCH_DOCS));
    });
};

export type ChangeCallback = (
  arg: PouchDB.Replication.SyncResult<MaybeModel>
) => void;

// tslint:disable max-func-body-length
export function sync<State>(
  db: PouchDB.Database<MaybeModel>,
  registerChangeCallback?: (callback: ChangeCallback) => () => void,
  modelsToSync?: string[],
  name?: string
): Middleware {
  const knownIDs: IDStorage = {};

  return (api: MiddlewareAPI<State>) => {
    return (next: Dispatch<State>) => {
      if (registerChangeCallback !== undefined) {
        registerChangeCallback(changeCallback(api, knownIDs, modelsToSync));
      }

      fetchDocuments(db, api, knownIDs, modelsToSync);

      return (action: Action | ThunkAction<{}, State, {}>) => {
        if (isFromSync(action)) {
          next(action as ThunkAction<{}, State, {}>);

          return;
        }
        if (!isAction(action)) {
          next(action as ThunkAction<{}, State, {}>);

          return;
        }

        if (
          isAction(action) &&
          hasMeta(action) &&
          !isModelToSync(action.meta, modelsToSync)
        ) {
          next(action);

          return;
        }

        if (isInsertAction(action)) {
          db
            .put(
              action.payload.toJSON !== undefined
                ? action.payload.toJSON()
                : action.payload
            )
            .then(async () => {
              return db.get(action.payload._id).then(doc => {
                if (!isModel(doc)) {
                  return;
                }
                action.payload = doc;
                next(action);
              });
            })
            .catch(error => {
              api.dispatch(modelError(error as Error, OPERATION_INSERT));
            });

          knownIDs[action.payload._id] = action.payload.kind;
        } else if (isUpdateAction(action)) {
          db
            .put(
              action.payload.toJSON !== undefined
                ? action.payload.toJSON()
                : action.payload
            )
            .then(async () => {
              return db.get(action.payload._id).then(doc => {
                if (!isModel(doc)) {
                  return;
                }
                action.payload = doc;
                next(action);
              });
            })
            .catch(error => {
              api.dispatch(modelError(error as Error, OPERATION_UPDATE));
            });
          knownIDs[action.payload._id] = action.payload.kind;
        } else if (isRemoveAction(action)) {
          db.remove(action.payload).catch(error => {
            api.dispatch(modelError(error as Error, OPERATION_REMOVE));
          });
          delete knownIDs[action.payload._id];
          next(action);
        } else {
          // tslint:disable-next-line no-any
          next((action as any) as ThunkAction<{}, State, {}>);
        }
      };
    };
  };
}
// tslint:enable max-func-body-length
