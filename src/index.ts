import { Action, Dispatch, Middleware, MiddlewareAPI } from 'redux';
import { ThunkAction } from 'redux-thunk';

export interface MaybeModel {
  kind?: string;
}

export type LOAD_MODELS = '@@sync/LOAD_MODELS';
export const LOAD_MODELS: LOAD_MODELS = '@@sync/LOAD_MODELS';
export type INSERT_MODEL = '@@sync/INSERT_MODEL';
export const INSERT_MODEL: INSERT_MODEL = '@@sync/INSERT_MODEL';
export type UPDATE_MODEL = '@@sync/UPDATE_MODEL';
export const UPDATE_MODEL: UPDATE_MODEL = '@@sync/UPDATE_MODEL';
export type REMOVE_MODEL = '@@sync/REMOVE_MODEL';
export const REMOVE_MODEL: REMOVE_MODEL = '@@sync/REMOVE_MODEL';
export type MODEL_ERROR = '@@sync/ERROR';
export const MODEL_ERROR: MODEL_ERROR = '@@sync/ERROR';
export type INITIALIZED = '@@sync/INITIALIZED';
export const INITIALIZED: INITIALIZED = '@@sync/INITIALIZED';

export type OPERATION_CHANGES = 'OPERATION_CHANGES';
export const OPERATION_CHANGES: OPERATION_CHANGES = 'OPERATION_CHANGES';
export type OPERATION_FETCH_DOCS = 'OPERATION_FETCH_DOCS';
export const OPERATION_FETCH_DOCS: OPERATION_FETCH_DOCS =
  'OPERATION_FETCH_DOCS';
export type OPERATION_INSERT = 'OPERATION_INSERT';
export const OPERATION_INSERT: OPERATION_INSERT = 'OPERATION_INSERT';
export type OPERATION_UPDATE = 'OPERATION_UPDATE';
export const OPERATION_UPDATE: OPERATION_UPDATE = 'OPERATION_UPDATE';
export type OPERATION_REMOVE = 'OPERATION_REMOVE';
export const OPERATION_REMOVE: OPERATION_REMOVE = 'OPERATION_REMOVE';

export type Operation =
  | OPERATION_CHANGES
  | OPERATION_FETCH_DOCS
  | OPERATION_INSERT
  | OPERATION_UPDATE
  | OPERATION_REMOVE;

export type LoadModels<M extends SyncModel> = {
  type: LOAD_MODELS;
  payload: M[];
  meta: { kind: string };
};

export function initialized(name?: string) {
  return {
    type: INITIALIZED,
    meta: {
      name: name,
    },
  };
}

export type Initialized = {
  type: INITIALIZED;
  meta: { name?: string };
};

export function loadModels<M extends SyncModel>(
  models: M[],
  kind: string
): LoadModels<M> {
  return {
    type: LOAD_MODELS,
    payload: models,
    meta: { kind: kind },
  };
}

export type ModelMeta = { kind: string; fromSync: boolean };

export type InsertModel<M extends SyncModel> = {
  type: INSERT_MODEL;
  payload: M;
  meta: ModelMeta;
};

export function insertModel<M extends SyncModel>(
  model: M,
  fromSync: boolean = false
) {
  return {
    type: INSERT_MODEL,
    payload: model,
    meta: { kind: model.kind, fromSync: fromSync },
  };
}

export type UpdateModel<M extends SyncModel> = {
  type: UPDATE_MODEL;
  payload: M;
  meta: ModelMeta;
};

export function updateModel<M extends SyncModel>(
  model: M,
  fromSync: boolean = false
) {
  return {
    type: UPDATE_MODEL,
    payload: model,
    meta: { kind: model.kind, fromSync: fromSync },
  };
}

export type RemoveModel = {
  type: REMOVE_MODEL;
  payload: { _id: string; _rev: string };
  meta: ModelMeta;
};

export function removeModel(
  doc: { _id: string; _rev: string },
  kind: string,
  fromSync: boolean = false
) {
  return {
    type: REMOVE_MODEL,
    payload: doc,
    meta: { kind: kind, fromSync: fromSync },
  };
}

export type ModelError = {
  type: MODEL_ERROR;
  payload: Error;
  meta: { operation: Operation };
};

export function modelError(error: Error, operation: Operation): ModelError {
  return {
    type: MODEL_ERROR,
    payload: error,
    meta: { operation: operation },
  };
}

export interface SyncModel {
  kind: string;
  _id: string;
  _rev?: string;
  // tslint:disable-next-line no-any
  [k: string]: any;
  toJSON?(): Object;
}

type DeletedDoc = PouchDB.Core.IdMeta &
  PouchDB.Core.RevisionIdMeta & { _deleted: boolean };

function isDeletedDoc(
  doc: PouchDB.Core.ExistingDocument<{}>
): doc is DeletedDoc {
  return '_deleted' in doc;
}

type ModelStorage = { [k: string]: SyncModel[] };
type IDStorage = { [k: string]: string };

function isModel(doc?: {}): doc is SyncModel {
  return doc !== undefined && 'kind' in doc;
}

function isModelToSync(
  doc?: {},
  modelsToSync: string[] = []
): doc is SyncModel {
  return isModel(doc) && modelsToSync.indexOf(doc.kind) >= 0;
}

function isAction(action: {} | Function): action is Action {
  return typeof action !== 'function' && 'type' in action;
}

type ActionWithMeta = {
  type: string;
  meta: { [k: string]: number | string | boolean | undefined };
};

type ActionWithFromSyncMeta = {
  type: string;
  meta: {
    fromSync: boolean;
    [k: string]: number | string | boolean | undefined;
  };
};

type InsertOrUpdate = InsertModel<SyncModel> | UpdateModel<SyncModel>;

function isInsertOrUpdateAction(
  action: {} | Function,
  type: string
): action is InsertOrUpdate {
  return isAction(action) && action.type === type;
}

function isRemoveAction(action: {} | Function): action is RemoveModel {
  return isAction(action) && action.type === REMOVE_MODEL;
}

function hasMeta(action: Action): action is ActionWithMeta {
  return 'meta' in action;
}

function hasFromSyncMeta(
  action: ActionWithMeta
): action is ActionWithFromSyncMeta {
  return 'fromSync' in action.meta;
}

function isFromSync(action: {} | Function) {
  if (!isAction(action)) {
    return false;
  }

  if (!hasMeta(action)) {
    return false;
  }

  if (!hasFromSyncMeta(action)) {
    return false;
  }

  return action.meta.fromSync;
}

// tslint:disable max-func-body-length
export function sync<State>(
  db: PouchDB.Database<MaybeModel>,
  registerChangeCallback?: (
    callback: (arg: PouchDB.Replication.SyncResult<{}>) => void
  ) => () => void,
  modelsToSync?: string[],
  name?: string
): Middleware {
  const knownIDs: IDStorage = {};

  return (api: MiddlewareAPI<State>) => {
    return (next: Dispatch<State>) => {
      if (registerChangeCallback !== undefined) {
        registerChangeCallback(result => {
          if (result.direction === 'push') {
            return;
          }

          result.change.docs.forEach(doc => {
            if (isDeletedDoc(doc) && knownIDs[doc._id] !== undefined) {
              api.dispatch(
                removeModel(
                  { _id: doc._id, _rev: doc._rev },
                  knownIDs[doc._id],
                  true
                )
              );
              delete knownIDs[doc._id];

              return;
            }

            if (!isModelToSync(doc, modelsToSync)) {
              return;
            }

            if (knownIDs[doc._id] !== undefined) {
              api.dispatch(updateModel(doc, true));
            } else {
              api.dispatch(insertModel(doc, true));
              knownIDs[doc._id] = doc.kind;
            }
          });
        });
      }

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

      return (action: Action | ThunkAction<{}, State, {}> | Action) => {
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

        if (isInsertOrUpdateAction(action, INSERT_MODEL)) {
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
        } else if (isInsertOrUpdateAction(action, UPDATE_MODEL)) {
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
