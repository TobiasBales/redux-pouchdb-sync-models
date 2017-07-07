import { Action } from 'redux';

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
export type MODEL_INITIALIZED = '@@sync/MODEL_INITIALIZED';
export const MODEL_INITIALIZED: MODEL_INITIALIZED = '@@sync/MODEL_INITIALIZED';

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

export function initialized(name?: string): Initialized {
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

export function modelInitialized(kind: string): ModelInitialized {
  return { type: MODEL_INITIALIZED, meta: { kind: kind } };
}

export type ModelInitialized = {
  type: MODEL_INITIALIZED;
  meta: { kind: string };
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
): InsertModel<M> {
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
): UpdateModel<M> {
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
): RemoveModel {
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

export type DeletedDoc = PouchDB.Core.IdMeta &
  PouchDB.Core.RevisionIdMeta & { _deleted: boolean };

export function isDeletedDoc(
  doc: PouchDB.Core.ExistingDocument<{}>
): doc is DeletedDoc {
  return '_deleted' in doc;
}

export function isModel(doc?: {}): doc is SyncModel {
  return doc !== undefined && 'kind' in doc;
}

export function isModelToSync(
  doc?: {},
  modelsToSync: string[] = []
): doc is SyncModel {
  return isModel(doc) && modelsToSync.indexOf(doc.kind) >= 0;
}

export function isAction(action: {} | Function): action is Action {
  return typeof action !== 'function' && 'type' in action;
}

export type ActionWithMeta = {
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

export function isInsertAction(
  action: {} | Function
): action is InsertModel<SyncModel> {
  return isAction(action) && action.type === INSERT_MODEL;
}

export function isUpdateAction(
  action: {} | Function
): action is UpdateModel<SyncModel> {
  return isAction(action) && action.type === UPDATE_MODEL;
}

export function isRemoveAction(action: {} | Function): action is RemoveModel {
  return isAction(action) && action.type === REMOVE_MODEL;
}

export function hasMeta(action: {} | Function): action is ActionWithMeta {
  return 'meta' in action;
}

function hasFromSyncMeta(
  action: ActionWithMeta
): action is ActionWithFromSyncMeta {
  return 'fromSync' in action.meta;
}

export function isFromSync(action: {} | Function) {
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
